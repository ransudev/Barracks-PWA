import assert from "node:assert/strict";
import { test } from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";
import { applyMigrations } from "@/server/db/migrate";
import { createBarber, findBarberById, updateBarber } from "@/server/services/barber.service";
import { listBarberSchedules, listShopHours, saveBarberSchedule, saveShopHours } from "@/server/services/schedule.service";
import { getBookingAvailability, getAnyBarberAvailability } from "@/server/services/booking-availability.service";
import { getBarberOperationalAvailability } from "@/server/services/barber-operational-availability.service";
import { barberStaffSchema } from "@/server/schemas/sprint.schema";

test("Phase 2 backfills ownership without changing Main hours or existing schedules", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(22);
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const barber = Number((await db.query("INSERT INTO barbers(first_name,last_name) VALUES('Legacy','Branch') RETURNING id")).rows[0].id);
    await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) VALUES($1,1,'11:00','15:00')", [barber]);
    await db.query("UPDATE shop_operating_hours SET open_time='10:00',close_time='17:00',is_closed=true WHERE day_of_week=0");
    const before = await listBarberSchedules(db, barber);
    await db.query("INSERT INTO branches(name,code) VALUES('Existing second','SECOND')");
    await applyMigrations(db);
    await applyMigrations(db);
    assert.equal((await findBarberById(db, barber))?.branchId, main);
    assert.deepEqual(await listBarberSchedules(db, barber), before);
    assert.deepEqual((await listShopHours(db, main))[0], { dayOfWeek: 0, openTime: "10:00", closeTime: "17:00", isClosed: true });
    assert.equal((await db.query("SELECT count(*) FROM shop_operating_hours")).rows[0].count, "14");
    await assert.rejects(db.query("UPDATE barbers SET branch_id=NULL WHERE id=$1", [barber]), (error: unknown) => (error as { code: string }).code === "23502");
  } finally { await cleanup(); }
});

test("branch hours initialize barbers and drive availability; safe moves preserve schedules", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Second','SECOND') RETURNING id")).rows[0].id);
    assert.equal((await listShopHours(db, second)).length, 7);
    await db.query("UPDATE shop_operating_hours SET open_time='12:00',close_time='16:00' WHERE branch_id=$1", [second]);
    await saveShopHours(db, { dayOfWeek: 0, openTime: "12:00", closeTime: "16:00", isClosed: true }, second);
    assert.equal((await listShopHours(db, main))[0].isClosed, false);
    assert.equal(barberStaffSchema.safeParse({ firstName: "A", lastName: "B", status: "available" }).success, false);
    await assert.rejects(createBarber(db, { branchId: 2147483647, firstName: "Invalid", lastName: "Branch", status: "available" }), (error: unknown) => (error as { code: string }).code === "23503");
    const barber = await createBarber(db, { branchId: second, firstName: "Second", lastName: "Barber", status: "available" });
    const shifts = await listBarberSchedules(db, barber.id);
    assert.equal(shifts.length, 7); assert.equal(shifts[0].isWorking, false);
    assert.equal(shifts[1].startTime, "12:00"); assert.equal(shifts[1].endTime, "16:00");
    await assert.rejects(saveBarberSchedule(db, barber.id, { dayOfWeek: 1, isWorking: true, startTime: "09:00", endTime: "19:00", breaks: [] }), /branch operating hours/);
    const input = { serviceId: "barracks-basic", barberId: barber.id, date: "2099-10-05" };
    const result = await getBookingAvailability(db, input, { now: new Date("2099-10-04T00:00:00Z") });
    assert.equal(result.slots[0]?.startTime, "12:00");
    assert.equal((await getAnyBarberAvailability(db, input, { now: new Date("2099-10-04T00:00:00Z") })).slots[0]?.startTime, "12:00");
    await db.query("UPDATE shop_operating_hours SET is_closed=true WHERE branch_id=$1", [main]);
    assert.equal((await getBookingAvailability(db, input, { now: new Date("2099-10-04T00:00:00Z") })).slots[0]?.startTime, "12:00");
    // Operational availability must likewise use the owning branch, at DB time.
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false WHERE branch_id=$1", [second]);
    await db.query("UPDATE barber_schedules SET start_time='00:00',end_time='23:59',is_working=true WHERE barber_id=$1", [barber.id]);
    assert.equal((await getBarberOperationalAvailability(db, barber.id)).available, true);
    await assert.rejects(updateBarber(db, barber.id, { branchId: main, firstName: "Second", lastName: "Barber", status: "available" }), /destination branch hours/);
    assert.equal((await findBarberById(db, barber.id))?.branchId, second);
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false WHERE branch_id=$1", [main]);
    await db.query("UPDATE shop_operating_hours SET is_closed=true WHERE branch_id=$1", [second]);
    assert.equal((await getBarberOperationalAvailability(db, barber.id)).available, false);
    await db.query("UPDATE shop_operating_hours SET is_closed=false WHERE branch_id=$1", [second]);
    const beforeMove = await listBarberSchedules(db, barber.id);
    assert.equal((await updateBarber(db, barber.id, { branchId: main, firstName: "Second", lastName: "Barber", status: "available" }))?.branchId, main);
    assert.deepEqual(await listBarberSchedules(db, barber.id), beforeMove);
    await db.query("INSERT INTO customers(first_name,last_name) VALUES('Active','Customer')");
    await db.query("INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status) VALUES((SELECT id FROM customers LIMIT 1),$1,'barracks-basic','Cut',100,'2099-10-05','12:00','confirmed')", [barber.id]);
    await assert.rejects(updateBarber(db, barber.id, { branchId: second, firstName: "Second", lastName: "Barber", status: "available" }), /active bookings/);
    await db.query("UPDATE bookings SET status='cancelled' WHERE barber_id=$1", [barber.id]);
    await db.query("INSERT INTO queue_entries(customer_id,barber_id,service_id,status) VALUES((SELECT id FROM customers LIMIT 1),$1,'barracks-basic','ready')", [barber.id]);
    await assert.rejects(updateBarber(db, barber.id, { branchId: second, firstName: "Second", lastName: "Barber", status: "available" }), /active bookings and queue/);
  } finally { await cleanup(); }
});
