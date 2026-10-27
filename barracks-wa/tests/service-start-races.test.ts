import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { applyMigrations } from "@/server/db/migrate";
import { updateBooking } from "@/server/services/booking.service";
import { addWalkIn, findQueueEntry, QueueServiceError, updateWalkInStatus } from "@/server/services/queue.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";
import { getBarberOperationalAvailability } from "@/server/services/barber-operational-availability.service";
import { getBookingAvailability } from "@/server/services/booking-availability.service";

async function fixture(db: Pool) {
  await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
  const barber = Number((await db.query("INSERT INTO barbers(first_name,last_name) VALUES('Race','Barber') RETURNING id")).rows[0].id);
  await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1,day,'00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
  const user = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id,is_verified) VALUES('Race','Guest','race-guest@test.local','fixture',(SELECT id FROM roles WHERE name='customer'),true) RETURNING id")).rows[0].id);
  const customer = Number((await db.query("INSERT INTO customers(user_id,first_name,last_name,phone) VALUES($1,'Race','Guest','09000000000') RETURNING id", [user])).rows[0].id);
  await db.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES('race-service','Race service',100,10,true)");
  return { barber, customer };
}

test("a wrapped reservation committed first blocks manual and suggested starts without changing the visit", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, "2026-10-12T15:46:00Z");
  try {
    const { barber, customer } = await fixture(db);
    const entry = await addWalkIn(db, { customerId: customer, serviceId: "race-service", barberId: barber });
    const booked = await reservation(db, customer, barber, 5);
    assert.ok((await db.query("SELECT end_time < booking_time AS wraps FROM bookings WHERE id=$1", [booked])).rows[0].wraps);
    await assert.rejects(updateWalkInStatus(db, entry.id, "in_progress"), { reason: "reservation_collision" });
    const { getNextCustomer } = await import("@/server/services/queue.service");
    assert.equal(await getNextCustomer(db, barber), null);
    assert.equal((await findQueueEntry(db, entry.id))?.status, "ready");
    assert.equal((await findQueueEntry(db, entry.id))?.startedAt, null);
  } finally { await cleanup(); }
});

test("migration 031 preserves active history and protects midnight intervals, unknown durations and exact adjacency", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(30, "2026-10-12T15:46:00Z");
  try {
    const { barber, customer } = await fixture(db);
    const entry = await addWalkIn(db, { customerId: customer, serviceId: "race-service", barberId: barber });
    await updateWalkInStatus(db, entry.id, "in_progress");
    const before = (await db.query("SELECT row_to_json(q) AS row FROM queue_entries q WHERE id=$1", [entry.id])).rows[0].row;
    // The old trigger admits this overlapping wrapped reservation. Preserve this
    // as an explicit pre-fix reproduction, then remove only the test reservation.
    const defective = await reservation(db, customer, barber, 5);
    await db.query("DELETE FROM bookings WHERE id=$1", [defective]);
    await applyMigrations(db);
    assert.deepEqual((await db.query("SELECT row_to_json(q) AS row FROM queue_entries q WHERE id=$1", [entry.id])).rows[0].row, before);
    assert.equal(Number((await db.query("SELECT count(*) FROM bookings")).rows[0].count), 0);
    await assert.rejects(reservation(db, customer, barber, 5), { code: "23P01", constraint: "bookings_active_barber_overlap" });
    // End TIME alone is not historical duration evidence; unknown occupies day.
    await assert.rejects(db.query(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,end_time)
      VALUES($1,$2,'race-service','Unknown legacy',100,'2026-10-12','09:00','09:10')`, [customer, barber]), { code: "23P01" });
    const adjacent = Number((await db.query(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      SELECT $1,$2,'race-service','Adjacent',100,10,local_start::date,local_start::time,(local_start+INTERVAL '10 minutes')::time
      FROM (SELECT (started_at+INTERVAL '10 minutes') AT TIME ZONE 'Asia/Manila' AS local_start FROM queue_entries WHERE id=$3) t RETURNING id`, [customer, barber, entry.id])).rows[0].id);
    assert.ok(adjacent > 0, "exact active-service end boundary must allow a reservation, even with wrapped end_time");
    await assert.rejects(db.query("UPDATE bookings SET booking_time=booking_time-INTERVAL '1 microsecond' WHERE id=$1", [adjacent]), { code: "23P01" });
  } finally { await cleanup(); }
});

test("previous-day wrapped reservations block early next-day starts and slots through their saved duration", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, "2026-10-12T16:05:00Z"); // Oct 13 00:05 Manila
  try {
    const { barber, customer } = await fixture(db);
    const id = Number((await db.query(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      VALUES($1,$2,'race-service','Previous day',100,40,'2026-10-12','23:50','00:30') RETURNING id`, [customer, barber])).rows[0].id);
    assert.equal((await getBarberOperationalAvailability(db, barber, { durationMinutes: 10, branchId: 1 })).reason, "reservation_collision");
    const result = await getBookingAvailability(db, { serviceId: "race-service", barberId: barber, date: "2026-10-13" }, { now: new Date("2026-10-12T16:05:00Z") });
    assert.equal(result.slots.some((slot) => slot.startTime === "00:15"), false);
    assert.equal(result.slots.some((slot) => slot.startTime === "00:30"), true, "exact reservation end is available");
    await db.query("UPDATE bookings SET end_time='00:01' WHERE id=$1", [id]);
    assert.equal((await getBarberOperationalAvailability(db, barber, { durationMinutes: 10, branchId: 1 })).reason, "reservation_collision", "display end_time must not override saved duration");
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [id]);
    assert.equal((await getBarberOperationalAvailability(db, barber, { durationMinutes: 10, branchId: 1 })).available, true);
  } finally { await cleanup(); }
});

test("late-night starts still require the full saved duration to fit shift and shop hours", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, "2026-10-12T15:46:00Z");
  try {
    const { barber, customer } = await fixture(db);
    await db.query("UPDATE services SET duration_minutes=15 WHERE id='race-service'");
    const entry = await addWalkIn(db, { customerId: customer, serviceId: "race-service", barberId: barber });
    await assert.rejects(updateWalkInStatus(db, entry.id, "in_progress"), { reason: "off_shift" });
    assert.equal((await findQueueEntry(db, entry.id))?.startedAt, null);
  } finally { await cleanup(); }
});

async function reservation(db: Pool, customer: number, barber: number, offsetMinutes = 0) {
  return Number((await db.query(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
    SELECT $1,$2,'race-service','Race service',100,10,local_start::date,local_start::time,(local_start+INTERVAL '10 minutes')::time
    FROM (SELECT (clock_timestamp() AT TIME ZONE 'Asia/Manila') + $3::integer*INTERVAL '1 minute' AS local_start) clock RETURNING id`,
  [customer, barber, offsetMinutes])).rows[0].id);
}

async function waitForBlocked(db: Pool, blockerPid: number, count: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const waiting = Number((await db.query(`WITH RECURSIVE blocked AS (
      SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
      UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))
    ) SELECT count(*) FROM blocked`, [blockerPid])).rows[0].count);
    if (waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Expected ${count} operations waiting on the barber lock`);
}

test("appointment starts exclude their own reservation and retain snapshotted duration after catalog edits", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, "2026-10-12T02:00:00Z");
  try {
    const { barber, customer } = await fixture(db);
    const id = await reservation(db, customer, barber);
    await updateBooking(db, id, { status: "checked_in" });
    await db.query("UPDATE services SET duration_minutes=120 WHERE id='race-service'");
    await db.query("INSERT INTO barber_unavailability(barber_id,starts_at,ends_at,reason) VALUES($1,clock_timestamp()+INTERVAL '20 minutes',clock_timestamp()+INTERVAL '3 hours','Later time away')", [barber]);
    const started = await updateBooking(db, id, { status: "in_progress" });
    assert.equal(started?.status, "in_progress");
    assert.equal(started?.durationMinutes, 10);
    const linked = (await db.query("SELECT status,service_duration_minutes_snapshot FROM queue_entries WHERE booking_id=$1", [id])).rows[0];
    assert.equal(linked.status, "in_progress");
    assert.equal(linked.service_duration_minutes_snapshot, 10);
  } finally { await cleanup(); }
});

test("legacy walk-in with unresolved duration fails closed after migration without changing its state", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(29, "2026-10-12T02:00:00Z");
  try {
    const { barber, customer } = await fixture(db);
    const entry = Number((await db.query("INSERT INTO queue_entries(customer_id,service_id,barber_id,status) VALUES($1,'race-service',$2,'ready') RETURNING id", [customer, barber])).rows[0].id);
    await applyMigrations(db);
    assert.equal((await db.query("SELECT service_duration_minutes_snapshot FROM queue_entries WHERE id=$1", [entry])).rows[0].service_duration_minutes_snapshot, null);
    await assert.rejects(updateWalkInStatus(db, entry, "in_progress"), (error: unknown) => error instanceof QueueServiceError && error.reason === "duration_unknown");
    const retained = await findQueueEntry(db, entry);
    assert.equal(retained?.status, "ready");
    assert.equal(retained?.startedAt, null);
  } finally { await cleanup(); }
});

for (const clock of ["2026-10-12T02:00:00Z", "2026-10-12T15:46:00Z"]) {
test(`a reservation racing a manual start at ${clock} cannot leave overlapping committed work`, { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, clock);
  const blocker = await db.connect();
  let operations: Promise<PromiseSettledResult<unknown>[]> | undefined;
  try {
    const { barber, customer } = await fixture(db);
    const entry = await addWalkIn(db, { customerId: customer, serviceId: "race-service", barberId: barber });
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM barbers WHERE id=$1 FOR UPDATE", [barber]);
    const pid = Number((await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    operations = Promise.allSettled([updateWalkInStatus(db, entry.id, "in_progress"), reservation(db, customer, barber, 5)]);
    await waitForBlocked(db, pid, 2);
    await blocker.query("COMMIT");
    const outcomes = await operations;
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = outcomes.find((result) => result.status === "rejected") as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof QueueServiceError && rejected.reason.reason === "reservation_collision"
      || rejected.reason?.code === "23P01", "Losing operation must report an interval conflict");
    const active = Number((await db.query("SELECT count(*) FROM queue_entries WHERE status='in_progress'")).rows[0].count);
    const booked = Number((await db.query("SELECT count(*) FROM bookings WHERE status='confirmed'")).rows[0].count);
    assert.equal(active + booked, 1);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    if (operations) await operations;
    await cleanup();
  }
});

test(`a start delayed on a barber lock at ${clock} records the actual start and protects its remaining interval`, { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(Infinity, clock);
  const blocker = await db.connect();
  let operation: Promise<PromiseSettledResult<unknown>[]> | undefined;
  try {
    const { barber, customer } = await fixture(db);
    const entry = await addWalkIn(db, { customerId: customer, serviceId: "race-service", barberId: barber });
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM barbers WHERE id=$1 FOR UPDATE", [barber]);
    const pid = Number((await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
    operation = Promise.allSettled([updateWalkInStatus(db, entry.id, "in_progress")]);
    await waitForBlocked(db, pid, 1);
    const releasedAt = (await blocker.query<{ instant: Date }>("SELECT clock_timestamp() AS instant")).rows[0].instant;
    await blocker.query("COMMIT");
    const [outcome] = await operation;
    assert.equal(outcome.status, "fulfilled");
    const persisted = (await findQueueEntry(db, entry.id))!;
    assert.ok(Date.parse(persisted.startedAt!) >= releasedAt.getTime(), "started_at must use the post-lock clock rather than transaction BEGIN");
    await assert.rejects(reservation(db, customer, barber, 5), { code: "23P01", constraint: "bookings_active_barber_overlap" });
    assert.equal((await findQueueEntry(db, entry.id))?.status, "in_progress");
    assert.equal(Number((await db.query("SELECT count(*) FROM bookings")).rows[0].count), 0);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    if (operation) await operation;
    await cleanup();
  }
});

}
