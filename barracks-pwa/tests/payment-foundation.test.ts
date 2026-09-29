import assert from "node:assert/strict";
import test from "node:test";
import { createTransactionSchema } from "@/server/schemas/payment.schema";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";
import { applyMigrations } from "@/server/db/migrate";

test("payment request accepts one visit and a supported method only", () => {
  assert.equal(createTransactionSchema.safeParse({ visit: { bookingId: 1 }, paymentMethod: "cash" }).success, true);
  assert.equal(createTransactionSchema.safeParse({ visit: { queueEntryId: 2 }, paymentMethod: "e_wallet" }).success, true);
  for (const input of [
    { visit: { bookingId: 1, queueEntryId: 2 }, paymentMethod: "cash" },
    { visit: { bookingId: 1 }, paymentMethod: "crypto" },
    { visit: { bookingId: 1 }, paymentMethod: "cash", amount: 0 },
  ]) assert.equal(createTransactionSchema.safeParse(input).success, false);
});

test("completed bookings and walk-ins create unique snapshotted payments", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const { createTransaction, findTransactionByReference, PaymentServiceError } = await import("@/server/services/payment.service");
  try {
    const staff = (await db.query<{ id: number }>(
      `INSERT INTO users(first_name,last_name,email,password_hash,role_id)
       VALUES('Pat','Cashier','cashier@test.local','hash',(SELECT id FROM roles WHERE name='front_desk')) RETURNING id`,
    )).rows[0].id;
    const customerUser = (await db.query<{ id: number }>(
      `INSERT INTO users(first_name,last_name,email,password_hash,role_id)
       VALUES('Ava','Client','client@test.local','hash',(SELECT id FROM roles WHERE name='customer')) RETURNING id`,
    )).rows[0].id;
    const customer = (await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [customerUser])).rows[0].id;
    const walkIn = (await db.query<{ id: number }>("INSERT INTO customers(first_name,last_name) VALUES('Will','Walkin') RETURNING id")).rows[0].id;
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Bea','Barber') RETURNING id")).rows[0].id;
    const booking = (await db.query<{ id: number }>(
      `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status)
       VALUES($1,$2,'barracks-basic','Original cut',425,'2026-09-20','09:00','completed') RETURNING id`, [customer, barber],
    )).rows[0].id;
    const entry = (await db.query<{ id: number }>(
      `INSERT INTO queue_entries(customer_id,barber_id,service_id,status,started_at,completed_at)
       VALUES($1,$2,'barracks-basic','completed',NOW()-INTERVAL '1 hour',NOW()) RETURNING id`, [walkIn, barber],
    )).rows[0].id;

    await assert.rejects(createTransaction(db, { visit: { bookingId: 999999 }, paymentMethod: "cash" }, staff),
      (error: unknown) => error instanceof PaymentServiceError && error.kind === "not_found");
    await assert.rejects(createTransaction(db, { visit: { bookingId: booking }, paymentMethod: "cash" }, customerUser),
      (error: unknown) => error instanceof PaymentServiceError && error.kind === "forbidden");

    const bookingPayment = await createTransaction(db, { visit: { bookingId: booking }, paymentMethod: "card" }, staff);
    assert.equal(bookingPayment.amount, 425);
    assert.equal(bookingPayment.serviceName, "Original cut");
    assert.equal(bookingPayment.customerName, "Ava Client");
    assert.equal(bookingPayment.cashierName, "Pat Cashier");
    assert.match(bookingPayment.reference, /^TX-[A-F0-9]{32}$/);
    const concurrent = await Promise.allSettled([
      createTransaction(db, { visit: { queueEntryId: entry }, paymentMethod: "cash" }, staff),
      createTransaction(db, { visit: { queueEntryId: entry }, paymentMethod: "cash" }, staff),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((result) => result.status === "rejected" &&
      result.reason instanceof PaymentServiceError && result.reason.kind === "conflict").length, 1);
    const walkInPayment = concurrent.find((result) => result.status === "fulfilled")!.value;
    assert.equal(walkInPayment.customerName, "Will Walkin");
    assert.equal(walkInPayment.queueEntryId, Number(entry));
    await assert.rejects(createTransaction(db, { visit: { queueEntryId: entry }, paymentMethod: "cash" }, staff),
      (error: unknown) => error instanceof PaymentServiceError && error.kind === "conflict");

    await db.query("UPDATE users SET first_name='Changed' WHERE id=$1", [customerUser]);
    await db.query("UPDATE barbers SET first_name='Changed' WHERE id=$1", [barber]);
    await db.query("UPDATE services SET name='Changed',current_price=999 WHERE id='barracks-basic'");
    const saved = await findTransactionByReference(db, bookingPayment.reference);
    assert.equal(saved?.customerName, "Ava Client");
    assert.equal(saved?.barberName, "Bea Barber");
    assert.equal(saved?.serviceName, "Original cut");
    assert.equal(saved?.amount, 425);
    assert.equal(Number((await db.query<{ count: string }>("SELECT count(*) FROM transaction_payments WHERE transaction_id=$1", [bookingPayment.id])).rows[0].count), 1);
    await assert.rejects(db.query("UPDATE transactions SET payment_method='bitcoin' WHERE id=$1", [bookingPayment.id]), { code: "23514" });
    await db.query("DELETE FROM customers WHERE id=$1", [customer]);
    const afterDelete = await findTransactionByReference(db, bookingPayment.reference);
    assert.equal(afterDelete?.bookingId, null);
    assert.equal(afterDelete?.visitType, "booking");
    assert.equal(afterDelete?.visitRecordId, Number(booking));
    assert.equal(afterDelete?.customerName, "Ava Client");
  } finally {
    await cleanup();
  }
});

test("migration backfills legacy transactions and retains unfamiliar historical values", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(16);
  try {
    const customer = (await db.query<{ id: number }>("INSERT INTO customers(first_name,last_name) VALUES('Old','Client') RETURNING id")).rows[0].id;
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Old','Barber') RETURNING id")).rows[0].id;
    const booking = (await db.query<{ id: number }>(
      `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status)
       VALUES($1,$2,'barracks-basic','Old service',300,'2026-09-20','10:00','completed') RETURNING id`, [customer, barber],
    )).rows[0].id;
    const oldId = (await db.query<{ id: string }>(
      "INSERT INTO transactions(customer_id,booking_id,barber_id,service_id,amount,payment_method,status) VALUES($1,$2,$3,'barracks-basic',300,'voucher','settled') RETURNING id",
      [customer, booking, barber],
    )).rows[0].id;
    await applyMigrations(db);
    const row = (await db.query<{
      reference: string; payment_method: string; status: string; legacy_payment_method: string;
      legacy_status: string; customer_name: string; service_name: string; visit_record_id: string;
    }>("SELECT * FROM transactions WHERE id=$1", [oldId])).rows[0];
    assert.equal(row.reference, `TX-LEGACY-${oldId}`);
    assert.equal(row.payment_method, "other");
    assert.equal(row.status, "unknown");
    assert.equal(row.legacy_payment_method, "voucher");
    assert.equal(row.legacy_status, "settled");
    assert.equal(row.customer_name, "Old Client");
    assert.equal(row.service_name, "Old service");
    assert.equal(Number(row.visit_record_id), Number(booking));
    assert.equal(Number((await db.query<{ count: string }>("SELECT count(*) FROM transaction_payments WHERE transaction_id=$1", [oldId])).rows[0].count), 1);
  } finally {
    await cleanup();
  }
});
