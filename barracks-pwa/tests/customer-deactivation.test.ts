import assert from "node:assert/strict";
import test from "node:test";
import { deleteCustomer } from "@/server/services/customer.service";
import { createBooking, updateBookingDetails } from "@/server/services/booking.service";
import { createBarber } from "@/server/services/barber.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

const cases = [
  { status: "confirmed", expected: "active_bookings" },
  { status: "checked_in", expected: "active_bookings" },
  { status: "in_progress", expected: "active_bookings" },
  { status: "completed", expected: "deleted" },
  { status: "cancelled", expected: "deleted" },
  { status: "no_show", expected: "deleted" },
  { status: null, expected: "deleted" },
] as const;

test("customer deactivation rejects active appointments and retains inactive booking history", { skip: !databaseConfigured }, async (t) => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    await db.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES('deactivation-cut','Deactivation cut',100,45,true)");
    for (const [index, { status, expected }] of cases.entries()) {
      await t.test(status ?? "no bookings", async () => {
        const user = (await db.query<{ id: number }>(
          `INSERT INTO users(first_name,last_name,email,password_hash,role_id)
           VALUES('Test','Customer',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id`,
          [`deactivation-${index}@test.local`],
        )).rows[0];
        const customer = (await db.query<{ id: number }>(
          "INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user.id],
        )).rows[0];
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 day')",
          [String(index).padStart(64, "0"), user.id],
        );
        let bookingId: number | undefined;
        if (status) {
          const barber = (await db.query<{ id: number }>(
            "INSERT INTO barbers(first_name,last_name) VALUES('Test','Barber') RETURNING id",
          )).rows[0];
          bookingId = (await db.query<{ id: number }>(
            `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,
              service_duration_minutes,booking_date,booking_time,end_time,status)
             VALUES($1,$2,'deactivation-cut','Deactivation cut',100,45,'2035-01-01','10:00','10:45',$3)
             RETURNING id`,
            [customer.id, barber.id, status],
          )).rows[0].id;
        }

        assert.equal(await deleteCustomer(db, customer.id), expected);
        const account = (await db.query<{ deleted_at: Date | null }>(
          "SELECT deleted_at FROM users WHERE id=$1", [user.id],
        )).rows[0];
        assert.equal(account.deleted_at === null, expected === "active_bookings");
        assert.equal(Number((await db.query(
          "SELECT count(*) AS count FROM sessions WHERE user_id=$1", [user.id],
        )).rows[0].count), expected === "active_bookings" ? 1 : 0);
        if (bookingId) {
          const booking = (await db.query<{ status: string; customer_id: number }>(
            "SELECT status,customer_id FROM bookings WHERE id=$1", [bookingId],
          )).rows[0];
          assert.equal(booking.status, status);
          assert.equal(booking.customer_id, customer.id);
        }
      });
    }
  } finally {
    await cleanup();
  }
});

test("booking writes keep active customer ownership after deactivation", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    await db.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES('customer-guard-cut','Guard cut',100,45,true)");
    const barber = await createBarber(db, { firstName: "Guard", lastName: "Barber", status: "available" });
    const customers: number[] = [];
    for (const index of [0, 1]) {
      const user = (await db.query<{ id: number }>(
        `INSERT INTO users(first_name,last_name,email,password_hash,role_id)
         VALUES('Guard','Customer',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id`,
        [`guard-${index}@test.local`],
      )).rows[0];
      customers.push((await db.query<{ id: number }>(
        "INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user.id],
      )).rows[0].id);
    }
    const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const booking = await createBooking(db, { customerId: customers[0], barberId: barber.id, serviceId: "customer-guard-cut", date, time: "10:00" });
    const edited = await updateBookingDetails(db, booking.id, {
      customerId: customers[0], barberId: barber.id, serviceId: "customer-guard-cut", date, time: "11:00", notes: "Updated",
    });
    assert.equal(edited?.time, "11:00");
    assert.equal(await deleteCustomer(db, customers[1]), "deleted");
    await assert.rejects(createBooking(db, { customerId: customers[1], barberId: barber.id, serviceId: "customer-guard-cut", date, time: "12:00" }), { kind: "not_found" });
    await assert.rejects(updateBookingDetails(db, booking.id, {
      customerId: customers[1], barberId: barber.id, serviceId: "customer-guard-cut", date, time: "12:00", notes: "Wrong customer",
    }), { kind: "not_found" });
    assert.equal((await db.query<{ customer_id: number }>("SELECT customer_id FROM bookings WHERE id=$1", [booking.id])).rows[0].customer_id, customers[0]);
  } finally {
    await cleanup();
  }
});

test("concurrent booking creation and customer deactivation cannot hide an active appointment", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    await db.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES('customer-race-cut','Race cut',100,45,true)");
    const barber = await createBarber(db, { firstName: "Race", lastName: "Barber", status: "available" });
    const user = (await db.query<{ id: number }>(
      `INSERT INTO users(first_name,last_name,email,password_hash,role_id)
       VALUES('Race','Customer','customer-race@test.local','test',(SELECT id FROM roles WHERE name='customer')) RETURNING id`,
    )).rows[0];
    const customer = (await db.query<{ id: number }>(
      "INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user.id],
    )).rows[0];
    const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const [creation, deactivation] = await Promise.allSettled([
      createBooking(db, { customerId: customer.id, barberId: barber.id, serviceId: "customer-race-cut", date, time: "10:00" }),
      deleteCustomer(db, customer.id),
    ]);
    assert.equal(deactivation.status, "fulfilled");
    assert.equal(creation.status === "fulfilled", deactivation.status === "fulfilled" && deactivation.value === "active_bookings");
    if (creation.status === "rejected") assert.equal(creation.reason.kind, "not_found");
    const state = (await db.query<{ deleted_at: Date | null; active_count: string }>(
      `SELECT u.deleted_at, (SELECT count(*) FROM bookings b
        WHERE b.customer_id=c.id AND b.status IN ('confirmed','checked_in','in_progress')) AS active_count
       FROM customers c JOIN users u ON u.id=c.user_id WHERE c.id=$1`, [customer.id],
    )).rows[0];
    assert.ok(state.deleted_at === null || Number(state.active_count) === 0);
  } finally {
    await cleanup();
  }
});
