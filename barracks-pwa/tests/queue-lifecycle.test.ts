import assert from "node:assert/strict";
import test from "node:test";
import { assertQueueState, initialQueueStatus, transitionQueue, type QueueState, type QueueStatus } from "@/server/services/queue-lifecycle";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

const state = (status: QueueStatus, barberId: number | null = null): QueueState => ({
  status, barberId, startedAt: status === "in_progress" || status === "completed" ? "2026-09-27T01:00:00Z" : null,
  completedAt: status === "completed" ? "2026-09-27T01:20:00Z" : null,
});

test("lifecycle helper accepts only the specified transitions", () => {
  assert.equal(initialQueueStatus(null), "waiting");
  assert.equal(initialQueueStatus(1), "ready");
  for (const [source, action, target] of [
    [state("waiting"), { barberId: 1 }, "ready"],
    [state("ready", 1), { barberId: 2 }, "ready"],
    [state("ready", 1), { barberId: null }, "waiting"],
    [state("ready", 1), { status: "in_progress" }, "in_progress"],
    [state("in_progress", 1), { status: "completed" }, "completed"],
    [state("waiting"), { status: "removed" }, "removed"],
    [state("ready", 1), { status: "removed" }, "removed"],
  ] as const) assert.equal(transitionQueue(source, action), target);
  for (const [source, action, message] of [
    [state("waiting"), { status: "in_progress" }, /barber must be assigned/],
    [state("waiting"), { status: "completed" }, /must be started/],
    [state("ready", 1), { status: "completed" }, /must be started/],
    [state("in_progress", 1), { status: "waiting" }, /Change the barber/],
    [state("in_progress", 1), { status: "removed" }, /cannot be removed/],
    [state("completed", 1), { barberId: null }, /already been completed/],
    [state("removed"), { status: "in_progress" }, /already been removed/],
  ] as const) assert.throws(() => transitionQueue(source, action), message);
});

test("lifecycle state rejects missing barber or timestamps and reversed time", () => {
  for (const invalid of [
    state("waiting", 1), state("ready"), { ...state("in_progress", 1), startedAt: null },
    { ...state("completed", 1), completedAt: null },
    { ...state("completed", 1), completedAt: "2026-09-27T00:00:00Z" },
  ]) {
    assert.throws(() => assertQueueState(invalid));
  }
});

test("walk-in and appointment service paths preserve lifecycle and timestamps", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const queue = await import("@/server/services/queue.service");
  const { updateBooking } = await import("@/server/services/booking.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barbers: number[] = [];
    for (let i = 0; i < 2; i++) {
      const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Life','Barber') RETURNING id")).rows[0].id;
      barbers.push(barber);
      await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1, day, '00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
    }
    const user = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Life','Customer','lifecycle@test.local','test',(SELECT id FROM roles WHERE name='customer')) RETURNING id")).rows[0].id;
    const customer = (await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user])).rows[0].id;
    const serviceId = "barracks-basic";

    const waiting = await queue.addWalkIn(db, { customerId: customer, serviceId });
    assert.equal(waiting.status, "waiting");
    assert.equal(waiting.barberId, null);
    assert.equal(waiting.startedAt, null);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "in_progress"), /barber must be assigned/);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "completed"), /must be started/);
    assert.equal((await queue.assignQueueBarber(db, waiting.id, barbers[0])).status, "ready");
    assert.equal((await queue.assignQueueBarber(db, waiting.id, barbers[1])).barberId, barbers[1]);
    assert.equal((await queue.assignQueueBarber(db, waiting.id, null)).status, "waiting");
    await queue.assignQueueBarber(db, waiting.id, barbers[0]);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "completed"), /must be started/);
    const started = await queue.updateWalkInStatus(db, waiting.id, "in_progress");
    assert.ok(started.startedAt);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "removed"), /cannot be removed/);
    await assert.rejects(queue.assignQueueBarber(db, waiting.id, null), /cannot be changed/);
    const completed = await queue.updateWalkInStatus(db, waiting.id, "completed");
    assert.ok(completed.completedAt && Date.parse(completed.completedAt) >= Date.parse(started.startedAt!));
    assert.equal(completed.startedAt, started.startedAt);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "removed"), /already been completed/);
    await assert.rejects(queue.updateWalkInStatus(db, waiting.id, "in_progress"), /already been completed/);

    const ready = await queue.addWalkIn(db, { customerId: customer, serviceId, barberId: barbers[0] });
    assert.equal(ready.status, "ready");
    assert.equal((await queue.updateWalkInStatus(db, ready.id, "removed")).status, "removed");
    await assert.rejects(queue.assignQueueBarber(db, ready.id, barbers[1]), /already been removed/);
    const removable = await queue.addWalkIn(db, { customerId: customer, serviceId });
    assert.equal((await queue.updateWalkInStatus(db, removable.id, "removed")).status, "removed");
    await assert.rejects(queue.updateWalkInStatus(db, removable.id, "removed"), /already been removed/);

    const booking = Number((await db.query<{ id: number }>(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      SELECT $1,$2,$3,'Barracks Basic',300,45,local_now::date,local_now::time,(local_now+INTERVAL '45 minutes')::time
      FROM (SELECT clock_timestamp() AT TIME ZONE 'Asia/Manila' AS local_now) t RETURNING id`, [customer, barbers[0], serviceId])).rows[0].id);
    await assert.rejects(updateBooking(db, booking, { status: "completed" }), /Cannot mark/);
    assert.equal((await updateBooking(db, booking, { status: "checked_in" }))?.status, "checked_in");
    const linked = (await queue.listQueue(db)).find((item) => item.bookingId === booking)!;
    assert.equal(linked.status, "ready");
    await assert.rejects(queue.assignQueueBarber(db, linked.id, barbers[1]), /Manage appointment status/);
    await assert.rejects(queue.updateWalkInStatus(db, linked.id, "removed"), /Manage appointment status/);
    await assert.rejects(queue.updateWalkInStatus(db, linked.id, "in_progress"), /Manage appointment status/);
    await assert.rejects(updateBooking(db, booking, { status: "completed" }), /Cannot mark/);
    assert.equal((await updateBooking(db, booking, { status: "in_progress" }))?.status, "in_progress");
    const appointmentStarted = (await queue.findQueueEntry(db, linked.id))!;
    assert.equal(appointmentStarted.status, "in_progress");
    assert.ok(appointmentStarted.startedAt);
    assert.equal((await updateBooking(db, booking, { status: "completed" }))?.status, "completed");
    const appointmentDone = (await queue.findQueueEntry(db, linked.id))!;
    assert.equal(appointmentDone.status, "completed");
    assert.equal(appointmentDone.startedAt, appointmentStarted.startedAt);
    assert.ok(appointmentDone.completedAt && Date.parse(appointmentDone.completedAt) >= Date.parse(appointmentStarted.startedAt!));
    await assert.rejects(updateBooking(db, booking, { status: "in_progress" }), /Cannot mark/);
    await assert.rejects(queue.updateWalkInStatus(db, linked.id, "removed"), /already been completed/);

    const staleBooking = Number((await db.query<{ id: number }>(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      VALUES($1,$2,$3,'Barracks Basic',300,45,CURRENT_DATE + 2,'10:00','10:45') RETURNING id`, [customer, barbers[1], serviceId])).rows[0].id);
    await db.query("INSERT INTO queue_entries(booking_id,customer_id,service_id,barber_id,status) VALUES($1,$2,$3,$4,'ready')", [staleBooking, customer, serviceId, barbers[1]]);
    await assert.rejects(updateBooking(db, staleBooking, { status: "checked_in" }), /out of sync/);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM bookings WHERE id=$1", [staleBooking])).rows[0].status, "confirmed");

    await assert.rejects(db.query("UPDATE queue_entries SET barber_id=NULL WHERE id=$1", [appointmentDone.id]), { code: "23514" });
    await assert.rejects(db.query("UPDATE queue_entries SET completed_at=started_at-INTERVAL '1 second' WHERE id=$1", [appointmentDone.id]), { code: "23514" });
  } finally { await cleanup(); }
});
