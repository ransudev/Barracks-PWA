import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { getBarberOperationalAvailability } from "@/server/services/barber-operational-availability.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

function intervalDb(block: "booking" | "break" | "shift" | "away" | "none"): Pool {
  const instant = new Date("2026-10-05T02:45:00Z"); // 10:45 Manila
  return { query: async (sql: string) => {
    if (sql.includes("SELECT status, branch_id FROM barbers")) return { rows: [{ branch_id: 1, status: "available" }] };
    if (sql.includes("FROM queue_entries")) return { rows: [] };
    if (sql.includes("WITH clock AS")) return { rows: [{ instant, local_time: "10:45:00", weekday: 1 }] };
    if (sql.includes("FROM barber_attendance")) return { rows: [] };
    if (sql.includes("FROM shop_operating_hours")) return { rows: [{ day_of_week: 1, open_time: "09:00", close_time: "19:00", is_closed: false }] };
    if (sql.includes("FROM barber_schedules")) return { rows: [{ id: 1, day_of_week: 1, is_working: true, start_time: "09:00", end_time: block === "shift" ? "11:00" : "19:00" }] };
    if (sql.includes("FROM barber_schedule_breaks")) return { rows: block === "break" ? [{ barber_schedule_id: 1, start_time: "11:00", end_time: "11:30" }] : [] };
    if (sql.includes("FROM barber_unavailability")) return { rows: block === "away" ? [{ id: 1, starts_at: new Date("2026-10-05T03:00:00Z"), ends_at: new Date("2026-10-05T03:30:00Z"), reason: "Time away" }] : [] };
    if (sql.includes("FROM bookings")) return { rows: block === "booking" ? [{ booking_time: "11:00:00", end_time: "11:30:00", service_duration_minutes: 30 }] : [] };
    throw new Error(`Unexpected query ${sql}`);
  } } as unknown as Pool;
}

test("10:45 service intervals respect appointments, breaks, shift end and time away with half-open boundaries", async () => {
  for (const [block, reason] of [["booking", "reservation_collision"], ["break", "break"], ["shift", "off_shift"], ["away", "temporary_unavailability"]] as const) {
    assert.equal((await getBarberOperationalAvailability(intervalDb(block), 1, { durationMinutes: 45, branchId: 1 })).reason, reason);
    assert.equal((await getBarberOperationalAvailability(intervalDb(block), 1, { durationMinutes: 15, branchId: 1 })).available, true, `end exactly at ${block} boundary is allowed`);
  }
  assert.equal((await getBarberOperationalAvailability(intervalDb("none"), 1, { durationMinutes: null, branchId: 1 })).reason, "duration_unknown");
  assert.equal((await getBarberOperationalAvailability(intervalDb("none"), 1, { durationMinutes: 15, branchId: 2 })).reason, "invalid_branch");
});

test("manual and suggested starts use immutable visit duration after catalog changes", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const queue = await import("@/server/services/queue.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Interval','Barber') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1,day,'00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
    const customer = (await db.query<{ id: number }>("INSERT INTO customers(first_name,last_name,phone) VALUES('Interval','Guest','09000000000') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES('interval-long','Long',300,45,true),('interval-short','Short',100,10,true)");
    const long = await queue.addWalkIn(db, { customerId: customer, serviceId: "interval-long", barberId: barber });
    const short = await queue.addWalkIn(db, { customerId: customer, serviceId: "interval-short" });
    await db.query("UPDATE services SET duration_minutes=5 WHERE id='interval-long'");
    await db.query("UPDATE services SET duration_minutes=120 WHERE id='interval-short'");
    await db.query(`INSERT INTO barber_unavailability(barber_id,starts_at,ends_at,reason)
      VALUES($1,clock_timestamp()+INTERVAL '20 minutes',clock_timestamp()+INTERVAL '1 hour','Future interval')`, [barber]);
    assert.equal((await queue.getNextCustomer(db, barber))?.id, short.id);
    await assert.rejects(queue.updateWalkInStatus(db, long.id, "in_progress"), /temporarily unavailable/);
    assert.equal((await queue.findQueueEntry(db, long.id))?.status, "ready");
    await assert.rejects(db.query("UPDATE queue_entries SET service_duration_minutes_snapshot=5 WHERE id=$1", [long.id]), /duration snapshot cannot be changed/);
    await queue.confirmNextCustomerAssignment(db, barber, short.id);
    assert.equal((await queue.updateWalkInStatus(db, short.id, "in_progress")).status, "in_progress");
  } finally { await cleanup(); }
});

test("today attendance blocks starts, preserves future booking slots, and rejects active clock-out", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const queue = await import("@/server/services/queue.service");
  const attendance = await import("@/server/services/attendance.service");
  const { getBookingAvailability } = await import("@/server/services/booking-availability.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Attendance','Barber') RETURNING id")).rows[0].id;
    const branchId = Number((await db.query("SELECT branch_id FROM barbers WHERE id=$1", [barber])).rows[0].branch_id);
    await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1,day,'00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
    const actor = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id,is_verified) VALUES('Test','Desk','attendance-start@test.local','test',(SELECT id FROM roles WHERE name='front_desk'),true) RETURNING id")).rows[0].id;
    await db.query("INSERT INTO user_branches(user_id,branch_id,is_primary) VALUES($1,$2,true)", [actor, branchId]);
    const entry = await queue.addWalkIn(db, { customer: { firstName: "Attendance", lastName: "Guest", phone: "09000000000" }, serviceId: "barracks-basic", barberId: barber });
    assert.equal((await getBarberOperationalAvailability(db, barber)).attendanceState, "unmarked");
    await attendance.actOnTodayAttendance(db, barber, actor, { action: "mark", status: "absent" });
    await assert.rejects(queue.updateWalkInStatus(db, entry.id, "in_progress", { id: actor, role: "front_desk" }), /marked absent/);
    await assert.rejects(queue.getNextCustomer(db, barber), /marked absent/);
    const tomorrow = (await db.query<{ date: string }>("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Manila')::date+1)::text AS date")).rows[0].date;
    assert.ok((await getBookingAvailability(db, { serviceId: "barracks-basic", barberId: barber, date: tomorrow })).slots.length > 0);
    await attendance.actOnTodayAttendance(db, barber, actor, { action: "clock_in" });
    assert.equal((await queue.updateWalkInStatus(db, entry.id, "in_progress", { id: actor, role: "front_desk" })).status, "in_progress");
    await assert.rejects(attendance.actOnTodayAttendance(db, barber, actor, { action: "clock_out" }), /Complete the active service/);
    await queue.updateWalkInStatus(db, entry.id, "completed");
    await attendance.actOnTodayAttendance(db, barber, actor, { action: "clock_out" });
    assert.equal((await getBarberOperationalAvailability(db, barber)).reason, "clocked_out");
  } finally { await cleanup(); }
});
