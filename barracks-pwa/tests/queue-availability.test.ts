import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { getBarberOperationalAvailability, requireBarberOperationalAvailability } from "@/server/services/barber-operational-availability.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

function fakeDb(input: { status?: string; active?: boolean; breakNow?: boolean; working?: boolean; absent?: boolean }): Pool {
  const instant = new Date("2026-10-05T02:00:00Z"); // Monday 10:00 Manila
  return { query: async (sql: string) => {
    if (sql.includes("SELECT status FROM barbers")) return { rows: [{ status: input.status ?? "available" }] };
    if (sql.includes("FROM queue_entries")) return { rows: input.active ? [{ id: 42 }] : [] };
    if (sql.includes("WITH clock AS")) return { rows: [{ instant, local_time: "10:00:00", weekday: 1 }] };
    if (sql.includes("FROM shop_operating_hours")) return { rows: [{ day_of_week: 1, open_time: "09:00:00", close_time: "19:30:00", is_closed: false }] };
    if (sql.includes("FROM barber_schedules")) return { rows: [{ id: 1, day_of_week: 1, is_working: input.working !== false, start_time: "09:00:00", end_time: "19:30:00" }] };
    if (sql.includes("FROM barber_schedule_breaks")) return { rows: input.breakNow ? [{ barber_schedule_id: 1, start_time: "09:30:00", end_time: "10:30:00" }] : [] };
    if (sql.includes("FROM barber_unavailability")) return { rows: input.absent ? [{ id: 1, starts_at: new Date(instant.getTime() - 60_000), ends_at: new Date(instant.getTime() + 60_000), reason: "Leave" }] : [] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as Pool;
}

test("operational rule accepts a free barber, including manually busy legacy status", async () => {
  assert.equal((await getBarberOperationalAvailability(fakeDb({}), 1)).available, true);
  assert.equal((await getBarberOperationalAvailability(fakeDb({ status: "busy" }), 1)).available, true);
});
test("operational rule reports manual, active, break, shift and absence blocks", async () => {
  for (const [input, reason] of [
    [{ status: "unavailable" }, "unavailable"], [{ active: true }, "serving_customer"],
    [{ breakNow: true }, "break"], [{ working: false }, "off_shift"],
    [{ absent: true }, "temporary_unavailability"],
  ] as const) {
    const result = await getBarberOperationalAvailability(fakeDb(input), 1);
    assert.equal(result.reason, reason);
    assert.throws(() => requireBarberOperationalAvailability(result), /Barber/);
  }
  assert.equal((await getBarberOperationalAvailability(fakeDb({ active: true }), 1)).activeQueueEntryId, 42);
});

test("queue assignments, appointment lifecycle and simultaneous starts share one barber guard", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const queue = await import("@/server/services/queue.service");
  const { updateBooking } = await import("@/server/services/booking.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Queue','Barber') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1, day, '00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
    const customers: number[] = [];
    for (let i = 0; i < 3; i++) {
      const user = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Queue','Customer',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id", [`queue-${i}@test.local`])).rows[0].id;
      customers.push((await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user])).rows[0].id);
    }
    const first = await queue.addWalkIn(db, { customerId: customers[0], serviceId: "barracks-basic", barberId: barber });
    const second = await queue.addWalkIn(db, { customerId: customers[1], serviceId: "barracks-basic" });
    assert.equal(second.status, "waiting");
    assert.equal((await queue.assignQueueBarber(db, second.id, barber)).status, "ready");
    const race = await Promise.allSettled([first.id, second.id].map((id) => queue.updateWalkInStatus(db, id, "in_progress")));
    assert.equal(race.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(race.filter((item) => item.status === "rejected" && item.reason instanceof queue.QueueServiceError && item.reason.message.includes("serving another customer")).length, 1);
    const winningId = (race[0].status === "fulfilled" ? first : second).id;
    const losingId = winningId === first.id ? second.id : first.id;
    await assert.rejects(queue.assignQueueBarber(db, losingId, barber), /serving another customer/);
    const direct = await db.query<{ id: number }>("SELECT id FROM queue_entries WHERE id=$1", [losingId]);
    await assert.rejects(db.query("UPDATE queue_entries SET status='in_progress',started_at=NOW() WHERE id=$1", [direct.rows[0].id]), (error: unknown) =>
      Boolean(error && typeof error === "object" && "code" in error && error.code === "23505"));
    await queue.updateWalkInStatus(db, winningId, "completed");
    assert.equal((await queue.assignQueueBarber(db, losingId, null)).status, "waiting");
    assert.equal((await queue.assignQueueBarber(db, losingId, barber)).status, "ready");
    await queue.updateWalkInStatus(db, losingId, "in_progress");
    await queue.updateWalkInStatus(db, losingId, "completed");

    await db.query("UPDATE barbers SET status='unavailable' WHERE id=$1", [barber]);
    await assert.rejects(queue.addWalkIn(db, { customerId: customers[2], serviceId: "barracks-basic", barberId: barber }), /unavailable/);
    await db.query("UPDATE barbers SET status='available' WHERE id=$1", [barber]);
    const third = await queue.addWalkIn(db, { customerId: customers[2], serviceId: "barracks-basic" });
    const day = Number((await db.query<{ day: number }>("SELECT EXTRACT(DOW FROM clock_timestamp() AT TIME ZONE 'Asia/Manila')::integer AS day")).rows[0].day);
    const schedule = (await db.query<{ id: number }>("SELECT id FROM barber_schedules WHERE barber_id=$1 AND day_of_week=$2", [barber, day])).rows[0].id;
    await db.query("INSERT INTO barber_schedule_breaks(barber_schedule_id,start_time,end_time) VALUES($1,'00:00','23:59')", [schedule]);
    await assert.rejects(queue.assignQueueBarber(db, third.id, barber), /scheduled break/);
    await db.query("DELETE FROM barber_schedule_breaks WHERE barber_schedule_id=$1", [schedule]);
    await db.query("UPDATE barber_schedules SET is_working=false WHERE id=$1", [schedule]);
    await assert.rejects(queue.assignQueueBarber(db, third.id, barber), /not scheduled/);
    await db.query("UPDATE barber_schedules SET is_working=true WHERE id=$1", [schedule]);
    await queue.assignQueueBarber(db, third.id, barber);
    await db.query("UPDATE barbers SET status='unavailable' WHERE id=$1", [barber]);
    await assert.rejects(queue.updateWalkInStatus(db, third.id, "in_progress"), /unavailable/);
    await db.query("UPDATE barbers SET status='available' WHERE id=$1", [barber]);
    await db.query("INSERT INTO barber_schedule_breaks(barber_schedule_id,start_time,end_time) VALUES($1,'00:00','23:59')", [schedule]);
    await assert.rejects(queue.updateWalkInStatus(db, third.id, "in_progress"), /scheduled break/);
    await db.query("DELETE FROM barber_schedule_breaks WHERE barber_schedule_id=$1", [schedule]);
    await db.query("UPDATE barber_schedules SET is_working=false WHERE id=$1", [schedule]);
    await assert.rejects(queue.updateWalkInStatus(db, third.id, "in_progress"), /not scheduled/);
    await db.query("UPDATE barber_schedules SET is_working=true WHERE id=$1", [schedule]);
    await db.query("INSERT INTO barber_unavailability(barber_id,starts_at,ends_at,reason) VALUES($1,clock_timestamp()-INTERVAL '1 minute',clock_timestamp()+INTERVAL '1 minute','Break')", [barber]);
    await assert.rejects(queue.updateWalkInStatus(db, third.id, "in_progress"), /temporarily unavailable/);
    await db.query("DELETE FROM barber_unavailability WHERE barber_id=$1", [barber]);
    const booking = Number((await db.query<{ id: number }>(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      SELECT $1,$2,'barracks-basic','Barracks Basic',300,45,local_now::date,local_now::time,(local_now+INTERVAL '45 minutes')::time
      FROM (SELECT clock_timestamp() AT TIME ZONE 'Asia/Manila' AS local_now) t RETURNING id`, [customers[0], barber])).rows[0].id);
    assert.equal((await updateBooking(db, booking, { status: "checked_in" }))?.status, "checked_in");
    assert.equal((await updateBooking(db, booking, { status: "in_progress" }))?.status, "in_progress");
    assert.equal((await queue.listQueue(db)).find((entry) => entry.bookingId === booking)?.status, "in_progress");
    await assert.rejects(queue.updateWalkInStatus(db, third.id, "in_progress"), /serving another customer/);
    assert.equal((await updateBooking(db, booking, { status: "completed" }))?.status, "completed");
    assert.equal((await queue.listQueue(db)).some((entry) => entry.bookingId === booking), false);
    assert.equal((await queue.listQueue(db, "completed-today")).find((entry) => entry.bookingId === booking)?.status, "completed");
    assert.equal((await queue.updateWalkInStatus(db, third.id, "in_progress")).status, "in_progress");
  } finally { await cleanup(); }
});
