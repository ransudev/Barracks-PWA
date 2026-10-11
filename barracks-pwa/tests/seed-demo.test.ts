import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import test from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

const runFile = promisify(execFile);
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

test("demo reseed cannot delete finalized financial records", { skip: !databaseConfigured }, async () => {
  const { db, schema, cleanup } = await createDisposableSchema();
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  assert.ok(connectionString);
  const isolatedTarget = new URL(connectionString);
  isolatedTarget.searchParams.set("options", `-c search_path=${schema},public`);
  const runSeed = () => runFile(process.execPath, [tsxCli, "scripts/seed-demo.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: isolatedTarget.toString(), POSTGRES_URL: "", PGOPTIONS: `-c search_path=${schema},public` },
  });

  try {
    await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
      VALUES('Test','Admin','seed-admin@test.local','test',(SELECT id FROM roles WHERE name='administrator'))`);
    await runSeed();

    const original = await db.query<{ id: number; customer_id: number; barber_id: number; service_id: string }>(
      "SELECT id,customer_id,barber_id,service_id FROM bookings WHERE demo_key='demo-ana-basic'",
    );
    const booking = original.rows[0];
    assert.ok(booking);
    const inserted = await db.query<{ id: string }>(
      "INSERT INTO queue_entries(customer_id,service_id,barber_id,status) VALUES($1,$2,$3,'ready') RETURNING id",
      [booking.customer_id, booking.service_id, booking.barber_id],
    );
    // Demo fixtures now contain several weeks of activity. Compare the full
    // retained state instead of assuming the original single-sale seed.
    const preserved = async () => (await db.query(`SELECT 'queue' AS name,count(*)::int AS count,
      md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS fingerprint FROM queue_entries t
      UNION ALL SELECT 'bookings',count(*)::int,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM bookings t
      UNION ALL SELECT 'transactions',count(*)::int,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM transactions t
      UNION ALL SELECT 'tenders',count(*)::int,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM transaction_payments t
      UNION ALL SELECT 'users',count(*)::int,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) FROM users t
      ORDER BY name`)).rows;
    const before = await preserved();
    await assert.rejects(runSeed(), /Finalized financial records cannot be deleted/);
    assert.deepEqual(await preserved(), before, "rejected reseed rolls back every retained financial/account fixture");
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM queue_entries WHERE id=$1", [inserted.rows[0].id])).rows[0].count), 1);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings WHERE id=$1", [booking.id])).rows[0].count), 1);
    assert.ok(before.find((row) => row.name === "transactions").count > 0);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM users WHERE email='seed-admin@test.local' AND deleted_at IS NULL")).rows[0].count), 1);
  } finally {
    await cleanup();
  }
});
