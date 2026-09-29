import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { getRevenueReport, summarizeRevenueEvents } from "@/server/services/revenue-report.service";
import { applyMigrations } from "@/server/db/migrate";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

const range = { from: "2026-09-02", to: "2026-09-03" };

test("revenue totals and all groupings count each sale and action once", () => {
  const report = summarizeRevenueEvents(range, [
    { day: "2026-09-02", service_name: "Classic cut", barber_name: "Alex", payment_method: "cash", event_type: "sale", amount: "100.00", transaction_count: "1" },
    { day: "2026-09-02", service_name: "Classic cut", barber_name: "Alex", payment_method: "cash", event_type: "sale", amount: "50.25", transaction_count: "1" },
    { day: "2026-09-02", service_name: "Shave", barber_name: "Bea", payment_method: "card", event_type: "sale", amount: "200.00", transaction_count: "1" },
    { day: "2026-09-03", service_name: "Classic cut", barber_name: "Alex", payment_method: "cash", event_type: "void", amount: "50.25", transaction_count: "0" },
    { day: "2026-09-03", service_name: "Shave", barber_name: "Bea", payment_method: "card", event_type: "refund", amount: "200.00", transaction_count: "0" },
  ]);
  assert.deepEqual(report.summary, { grossSales: 350.25, refundedAmount: 200, voidedAmount: 50.25,
    reversedAmount: 250.25, netRevenue: 100, transactionCount: 3 });
  assert.deepEqual(report.dailySales.map(({ label, grossSales, reversedAmount, netRevenue, transactionCount }) =>
    [label, grossSales, reversedAmount, netRevenue, transactionCount]),
  [["2026-09-02", 350.25, 0, 350.25, 3], ["2026-09-03", 0, 250.25, -250.25, 0]]);
  assert.deepEqual(report.byService.map(({ label, netRevenue }) => [label, netRevenue]), [["Classic cut", 100], ["Shave", 0]]);
  assert.deepEqual(report.byBarber.map(({ label, netRevenue }) => [label, netRevenue]), [["Alex", 100], ["Bea", 0]]);
  assert.deepEqual(report.byPaymentMethod.map(({ label, netRevenue }) => [label, netRevenue]), [["cash", 100], ["card", 0]]);
});

test("zero-data reports return zero summary and empty breakdowns", () => {
  const report = summarizeRevenueEvents(range, []);
  assert.deepEqual(report.summary, { grossSales: 0, refundedAmount: 0, voidedAmount: 0,
    reversedAmount: 0, netRevenue: 0, transactionCount: 0 });
  assert.deepEqual([report.dailySales, report.byService, report.byBarber, report.byPaymentMethod], [[], [], [], []]);
});

test("report query uses inclusive Manila-local days and one event stream", async () => {
  let values: unknown[] = [];
  let sql = "";
  const db = { query: async (query: string, parameters: unknown[]) => {
    sql = query; values = parameters; return { rows: [] };
  } } as unknown as Pool;
  await getRevenueReport(db, range);
  assert.deepEqual(values, ["2026-09-02T00:00:00+08:00", "2026-09-04T00:00:00+08:00"]);
  assert.match(sql, /transaction_financial_actions/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM transaction_financial_actions/);
  assert.match(sql, /Asia\/Manila/);
  assert.doesNotMatch(sql, /barbers\.revenue|JOIN transaction_payments/i);
});

test("pre-action reversed transactions are counted once using their transaction date", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(19);
  try {
    const customer = Number((await db.query<{ id: number }>("INSERT INTO customers(first_name,last_name) VALUES('Legacy','Customer') RETURNING id")).rows[0].id);
    const barber = Number((await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Legacy','Barber') RETURNING id")).rows[0].id);
    const booking = Number((await db.query<{ id: number }>(
      `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status)
       VALUES($1,$2,'barracks-basic','Legacy cut',75,'2026-09-02','12:00','completed') RETURNING id`, [customer, barber])).rows[0].id);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const tx = Number((await client.query<{ id: string }>(
        `INSERT INTO transactions(customer_id,booking_id,visit_type,visit_record_id,barber_id,service_id,
          customer_name,barber_name,service_name,amount,payment_method,status,created_at)
         VALUES($1,$2,'booking',$2,$3,'barracks-basic','Legacy Customer','Legacy Barber','Legacy cut',75,'card','refunded','2026-09-02T08:00:00Z') RETURNING id`,
        [customer, booking, barber])).rows[0].id);
      await client.query("INSERT INTO transaction_payments(transaction_id,payment_method,amount,status) VALUES($1,'card',75,'refunded')", [tx]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    await applyMigrations(db);
    const report = await getRevenueReport(db, range);
    assert.equal(report.summary.grossSales, 75);
    assert.equal(report.summary.refundedAmount, 75);
    assert.equal(report.summary.netRevenue, 0);
    assert.equal(report.summary.transactionCount, 1);
  } finally { await cleanup(); }
});

test("persisted report uses sale snapshots and action dates across Manila midnight", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const customer = Number((await db.query<{ id: number }>("INSERT INTO customers(first_name,last_name) VALUES('Report','Customer') RETURNING id")).rows[0].id);
    const barber = Number((await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Current','Barber') RETURNING id")).rows[0].id);
    const sale = async (time: string, amount: number, service: string, barberName: string, method: string) => {
      const client = await db.connect();
      try {
      await client.query("BEGIN");
      const booking = Number((await client.query<{ id: number }>(
        `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status)
         VALUES($1,$2,'barracks-basic',$3,$4,'2026-09-02','10:00','completed') RETURNING id`,
        [customer, barber, service, amount])).rows[0].id);
      const tx = Number((await client.query<{ id: string }>(
        `INSERT INTO transactions(customer_id,booking_id,visit_type,visit_record_id,barber_id,service_id,
           customer_name,barber_name,service_name,amount,payment_method,status,created_at)
         VALUES($1,$2,'booking',$2,$3,'barracks-basic','Report Customer',$4,$5,$6,$7,'completed',$8) RETURNING id`,
        [customer, booking, barber, barberName, service, amount, method, time])).rows[0].id);
      await client.query(`INSERT INTO transaction_payments(transaction_id,payment_method,amount,status,amount_received,change_amount)
        VALUES($1,$2,$3,'completed',$4,$5)`, [tx, method, amount, method === "cash" ? amount : null, method === "cash" ? 0 : null]);
      await client.query("COMMIT");
      return tx;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    };
    const old = await sale("2026-09-01T15:59:00Z", 100, "Original cut", "Former barber", "cash");
    const current = await sale("2026-09-01T16:00:00Z", 200, "Original shave", "Former barber", "card");
    const voided = await sale("2026-09-02T12:00:00Z", 50, "Original cut", "Other barber", "cash");
    await db.query("UPDATE barbers SET first_name='Renamed' WHERE id=$1", [barber]);
    await db.query("UPDATE services SET name='Renamed service' WHERE id='barracks-basic'");
    for (const [id, action, amount] of [[old, "refund", 100], [current, "refund", 200], [voided, "void", 50]] as const) {
      const client = await db.connect();
      try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO transaction_financial_actions(transaction_id,action_type,amount,reason,staff_name,created_at)
        VALUES($1,$2,$3,'Report test','Manager','2026-09-03T00:00:00+08:00')`, [id, action, amount]);
      await client.query("UPDATE transactions SET status=$2 WHERE id=$1", [id, action === "refund" ? "refunded" : "voided"]);
      await client.query("UPDATE transaction_payments SET status=$2 WHERE transaction_id=$1", [id, action === "refund" ? "refunded" : "voided"]);
      await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
    const report = await getRevenueReport(db, range);
    assert.deepEqual(report.summary, { grossSales: 250, refundedAmount: 300, voidedAmount: 50,
      reversedAmount: 350, netRevenue: -100, transactionCount: 2 });
    assert.deepEqual(report.dailySales.map((row) => [row.label, row.grossSales, row.reversedAmount]),
      [["2026-09-02", 250, 0], ["2026-09-03", 0, 350]]);
    assert.deepEqual(report.byService.map((row) => row.label).sort(), ["Original cut", "Original shave"]);
    assert.deepEqual(report.byBarber.map((row) => row.label).sort(), ["Former barber", "Other barber"]);
    assert.deepEqual(report.byPaymentMethod.map((row) => row.label).sort(), ["card", "cash"]);
  } finally { await cleanup(); }
});
