import assert from "node:assert/strict";
import test from "node:test";
import { walkInSchema } from "@/server/schemas/queue.schema";
import { QueueServiceError } from "@/server/services/queue.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("walk-in input accepts accountless names and rejects login-only fields or invalid contact data", () => {
  assert.equal(walkInSchema.safeParse({
    customer: { firstName: "Walk", lastName: "In", phone: "09123456789" },
    serviceId: "barracks-basic",
    idempotencyKey: "80eeff0a-bc02-4d1d-8415-18df4533ee7f",
  }).success, true);
  assert.equal(walkInSchema.safeParse({
    customerId: 42,
    serviceId: "barracks-basic",
    idempotencyKey: "80eeff0a-bc02-4d1d-8415-18df4533ee7f",
  }).success, true);
  assert.equal(walkInSchema.safeParse({
    customer: { firstName: "Walk", lastName: "In", phone: "123456789012" },
    serviceId: "barracks-basic",
    idempotencyKey: "80eeff0a-bc02-4d1d-8415-18df4533ee7f",
  }).success, false);
  assert.equal(walkInSchema.safeParse({
    customer: { firstName: "Walk", lastName: "In", email: "walk@test.local", password: "not-needed" },
    serviceId: "barracks-basic",
    idempotencyKey: "80eeff0a-bc02-4d1d-8415-18df4533ee7f",
  }).success, false);
});

test("quick walk-ins are transactional, idempotent, and preserve registered-customer queue behavior", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const { addWalkIn, listQueue } = await import("@/server/services/queue.service");
  const { listCustomers } = await import("@/server/services/customer.service");
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
    const barberId = (await db.query<{ id: number }>(
      "INSERT INTO barbers(first_name,last_name) VALUES('Quick','Barber') RETURNING id",
    )).rows[0].id;
    await db.query(
      "INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1,day,'00:00','23:59' FROM generate_series(0,6) AS day",
      [barberId],
    );

    const userId = (await db.query<{ id: number }>(
      "INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Registered','Customer','registered-queue@test.local','existing-hash',(SELECT id FROM roles WHERE name='customer')) RETURNING id",
    )).rows[0].id;
    const registeredId = (await db.query<{ id: number }>(
      "INSERT INTO customers(user_id) VALUES($1) RETURNING id",
      [userId],
    )).rows[0].id;
    const usersBefore = Number((await db.query<{ count: string }>("SELECT count(*) AS count FROM users")).rows[0].count);

    const existingEntry = await addWalkIn(db, { customerId: registeredId, serviceId: "barracks-basic" });
    assert.equal(existingEntry.customerName, "Registered Customer");
    assert.equal(existingEntry.status, "waiting");

    const idempotencyKey = "80eeff0a-bc02-4d1d-8415-18df4533ee7f";
    const request = {
      customer: { firstName: "Quick", lastName: "Guest", phone: "09123456789" },
      serviceId: "barracks-basic",
      idempotencyKey,
    };
    const [walkIn, duplicate] = await Promise.all([addWalkIn(db, request), addWalkIn(db, request)]);
    assert.equal(walkIn.id, duplicate.id);
    assert.equal(walkIn.customerId, duplicate.customerId);
    assert.equal(walkIn.customerName, "Quick Guest");
    assert.equal(walkIn.status, "waiting");
    assert.equal(walkIn.barberId, null);
    assert.equal(Number((await db.query<{ count: string }>(
      "SELECT count(*) AS count FROM customers WHERE user_id IS NULL AND first_name='Quick' AND last_name='Guest'",
    )).rows[0].count), 1);
    assert.equal(Number((await db.query<{ count: string }>(
      "SELECT count(*) AS count FROM queue_entries WHERE idempotency_key=$1",
      [idempotencyKey],
    )).rows[0].count), 1);
    await assert.rejects(addWalkIn(db, {
      ...request,
      customer: { ...request.customer, firstName: "Different" },
    }), /different details/);
    assert.equal(Number((await db.query<{ count: string }>("SELECT count(*) AS count FROM users")).rows[0].count), usersBefore);

    const customers = await listCustomers(db);
    const accountless = customers.find((customer) => customer.id === walkIn.customerId)!;
    const registered = customers.find((customer) => customer.id === registeredId)!;
    assert.equal(accountless.userId, null);
    assert.equal(accountless.email, "");
    assert.equal(accountless.phone, "09123456789");
    assert.equal(registered.userId, userId);
    assert.equal(registered.email, "registered-queue@test.local");

    const assigned = await addWalkIn(db, {
      customer: { firstName: "Assigned", lastName: "Guest", phone: "" },
      serviceId: "barracks-basic",
      barberId,
    });
    assert.equal(assigned.status, "ready");
    assert.equal(assigned.barberId, barberId);
    assert.equal(Number((await db.query<{ count: string }>("SELECT count(*) AS count FROM users")).rows[0].count), usersBefore);

    const queueCountBeforeInvalid = Number((await db.query<{ count: string }>("SELECT count(*) AS count FROM queue_entries")).rows[0].count);
    await assert.rejects(addWalkIn(db, {
      customer: { firstName: "Rollback", lastName: "Service", phone: "" },
      serviceId: "missing-service",
    }), (error: unknown) => error instanceof QueueServiceError && error.kind === "invalid");
    await assert.rejects(addWalkIn(db, {
      customer: { firstName: "Rollback", lastName: "Barber", phone: "" },
      serviceId: "barracks-basic",
      barberId: 2_147_483_647,
    }), /Barber not found/);
    assert.equal(Number((await db.query<{ count: string }>(
      "SELECT count(*) AS count FROM customers WHERE user_id IS NULL AND first_name='Rollback'",
    )).rows[0].count), 0);
    assert.equal(Number((await db.query<{ count: string }>("SELECT count(*) AS count FROM queue_entries")).rows[0].count), queueCountBeforeInvalid);
    assert.equal((await listQueue(db)).filter((entry) => entry.customerName === "Quick Guest").length, 1);
  } finally {
    await cleanup();
  }
});
