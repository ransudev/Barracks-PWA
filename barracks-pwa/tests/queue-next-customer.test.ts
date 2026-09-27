import assert from "node:assert/strict";
import test from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("next customer prefers assigned ready entries, then the oldest unassigned walk-in", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const queue = await import("@/server/services/queue.service");
  const { updateBooking } = await import("@/server/services/booking.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barbers: number[] = [];
    for (let i = 0; i < 2; i++) {
      const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Next','Barber') RETURNING id")).rows[0].id;
      barbers.push(barber);
      await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1, day, '00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
    }
    const user = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Next','Customer','next-customer@test.local','test',(SELECT id FROM roles WHERE name='customer')) RETURNING id")).rows[0].id;
    const customerId = (await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user])).rows[0].id;
    const serviceId = "barracks-basic";
    const [firstBarber, secondBarber] = barbers;

    assert.equal(await queue.getNextCustomer(db, firstBarber), null);
    const oldest = await queue.addWalkIn(db, { customerId, serviceId });
    const later = await queue.addWalkIn(db, { customerId, serviceId });
    await db.query("UPDATE queue_entries SET joined_at=NOW()-INTERVAL '2 hours' WHERE id=$1", [oldest.id]);
    await db.query("UPDATE queue_entries SET joined_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [later.id]);
    assert.equal((await queue.getNextCustomer(db, firstBarber))?.id, oldest.id);
    assert.equal((await queue.findQueueEntry(db, oldest.id))?.status, "waiting", "suggestion must not change state");

    const otherAssigned = await queue.addWalkIn(db, { customerId, serviceId, barberId: secondBarber });
    await db.query("UPDATE queue_entries SET joined_at=NOW()-INTERVAL '3 hours' WHERE id=$1", [otherAssigned.id]);
    assert.equal((await queue.getNextCustomer(db, firstBarber))?.id, oldest.id, "another barber's entry is excluded");
    assert.equal((await queue.getNextCustomer(db, secondBarber))?.id, otherAssigned.id);

    const ownAssigned = await queue.addWalkIn(db, { customerId, serviceId, barberId: firstBarber });
    assert.equal((await queue.getNextCustomer(db, firstBarber))?.id, ownAssigned.id, "assigned ready entry takes precedence over older waiting entries");
    await assert.rejects(queue.confirmNextCustomerAssignment(db, firstBarber, oldest.id), /Find the next customer again/, "a stale waiting suggestion cannot skip the new assigned entry");
    await queue.updateWalkInStatus(db, ownAssigned.id, "removed");
    await queue.updateWalkInStatus(db, otherAssigned.id, "removed");
    await assert.rejects(queue.confirmNextCustomerAssignment(db, firstBarber, later.id), /Find the next customer again/);
    const confirmed = await queue.confirmNextCustomerAssignment(db, firstBarber, oldest.id);
    assert.equal(confirmed.status, "ready");
    assert.equal(confirmed.barberId, firstBarber);
    assert.equal(confirmed.startedAt, null, "confirming assignment must not start service");
    assert.equal((await queue.getNextCustomer(db, firstBarber))?.id, oldest.id);
    assert.equal((await queue.getNextCustomer(db, secondBarber))?.id, later.id);
    await assert.rejects(queue.confirmNextCustomerAssignment(db, secondBarber, oldest.id), /suggestion changed/);

    const inProgress = await queue.updateWalkInStatus(db, oldest.id, "in_progress");
    assert.ok(inProgress.startedAt);
    await assert.rejects(queue.getNextCustomer(db, firstBarber), /serving another customer/);
    await queue.updateWalkInStatus(db, oldest.id, "completed");
    assert.equal((await queue.getNextCustomer(db, firstBarber))?.id, later.id, "completed and removed entries are excluded");
    await queue.updateWalkInStatus(db, later.id, "removed");
    assert.equal(await queue.getNextCustomer(db, firstBarber), null);

    const booking = Number((await db.query<{ id: number }>(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      VALUES($1,$2,$3,'Barracks Basic',300,45,CURRENT_DATE + 2,'10:00','10:45') RETURNING id`, [customerId, firstBarber, serviceId])).rows[0].id);
    assert.equal(await queue.getNextCustomer(db, firstBarber), null, "future confirmed booking has not checked in");
    assert.equal((await updateBooking(db, booking, { status: "checked_in" }))?.status, "checked_in");
    const linked = (await queue.getNextCustomer(db, firstBarber))!;
    assert.equal(linked.bookingId, booking);
    assert.equal(linked.status, "ready");
    assert.equal(linked.startedAt, null);
    await assert.rejects(queue.confirmNextCustomerAssignment(db, firstBarber, linked.id), /suggestion changed/);
    assert.equal((await updateBooking(db, booking, { status: "in_progress" }))?.status, "in_progress");
    await assert.rejects(queue.getNextCustomer(db, firstBarber), /serving another customer/);
    assert.equal((await updateBooking(db, booking, { status: "completed" }))?.status, "completed");
    assert.equal(await queue.getNextCustomer(db, firstBarber), null);

    const unchecked = Number((await db.query<{ id: number }>(`INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      VALUES($1,$2,$3,'Barracks Basic',300,45,CURRENT_DATE + 3,'10:00','10:45') RETURNING id`, [customerId, firstBarber, serviceId])).rows[0].id);
    await db.query("INSERT INTO queue_entries(booking_id,customer_id,service_id,barber_id,status) VALUES($1,$2,$3,$4,'ready')", [unchecked, customerId, serviceId, firstBarber]);
    assert.equal(await queue.getNextCustomer(db, firstBarber), null, "even a stale queue row cannot surface an unchecked booking");

    await db.query("UPDATE barbers SET status='unavailable' WHERE id=$1", [firstBarber]);
    await assert.rejects(queue.getNextCustomer(db, firstBarber), /unavailable/);
  } finally { await cleanup(); }
});
