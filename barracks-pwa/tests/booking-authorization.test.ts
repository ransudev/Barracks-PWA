import assert from "node:assert/strict";
import test from "node:test";
import { canManageBooking } from "@/app/constants/roles";
import { createBooking, updateBooking } from "@/server/services/booking.service";
import { createBarber } from "@/server/services/barber.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("customer cancellation is owner-scoped and limited to confirmed bookings", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const barber = await createBarber(db, { firstName: "Policy", lastName: "Barber", status: "available" });
    const customers: number[] = [];
    for (const index of [0, 1]) {
      const user = await db.query<{ id: number }>(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
        VALUES('Policy','Customer',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id`, [`policy-${index}@test.local`]);
      const customer = await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user.rows[0].id]);
      customers.push(customer.rows[0].id);
    }
    const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const book = (customerId: number, time: string) => createBooking(db, { customerId, barberId: barber.id, serviceId: "barracks-basic", date, time });

    const confirmed = await book(customers[0], "10:00");
    assert.equal((await updateBooking(db, confirmed.id, { status: "cancelled" }, { customerId: customers[0] }))?.status, "cancelled");

    const checkedIn = await book(customers[0], "11:00");
    assert.equal((await updateBooking(db, checkedIn.id, { status: "checked_in" }))?.status, "checked_in");
    await assert.rejects(updateBooking(db, checkedIn.id, { status: "cancelled" }, { customerId: customers[0] }), { kind: "not_updatable" });
    assert.equal((await updateBooking(db, checkedIn.id, { status: "cancelled" }))?.status, "cancelled", "staff may still cancel checked-in bookings");

    const inProgress = await book(customers[0], "12:00");
    await updateBooking(db, inProgress.id, { status: "checked_in" });
    await updateBooking(db, inProgress.id, { status: "in_progress" });
    await assert.rejects(updateBooking(db, inProgress.id, { status: "cancelled" }, { customerId: customers[0] }), { kind: "not_updatable" });

    const otherCustomer = await book(customers[1], "13:00");
    await assert.rejects(updateBooking(db, otherCustomer.id, { status: "cancelled" }, { customerId: customers[0] }), { kind: "forbidden" });
    assert.equal((await updateBooking(db, otherCustomer.id, { status: "cancelled" }, { customerId: customers[1] }))?.status, "cancelled");
    assert.equal(canManageBooking("front_desk", "delete"), false);
    assert.equal(canManageBooking("front_desk", "cancel"), true);
    assert.equal(canManageBooking("manager", "delete"), true);
    assert.equal(canManageBooking("administrator", "delete"), true);
  } finally { await cleanup(); }
});
