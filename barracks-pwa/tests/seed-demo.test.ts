import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import test from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

const runFile = promisify(execFile);
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

test("demo reseed clears walk-ins and appointment queue entries before referenced records", { skip: !databaseConfigured }, async () => {
  const { db, schema, cleanup } = await createDisposableSchema();
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  const runSeed = () => runFile(process.execPath, [tsxCli, "scripts/seed-demo.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: connectionString, PGOPTIONS: `-c search_path=${schema},public` },
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
    await db.query(
      "INSERT INTO queue_entries(customer_id,service_id,barber_id) VALUES($1,$2,$3)",
      [booking.customer_id, booking.service_id, booking.barber_id],
    );
    await runSeed();
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM queue_entries")).rows[0].count), 0);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM customers")).rows[0].count), 4);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings")).rows[0].count), 4);

    const replacement = (await db.query<{ id: number; customer_id: number; barber_id: number; service_id: string }>(
      "SELECT id,customer_id,barber_id,service_id FROM bookings WHERE demo_key='demo-ana-basic'",
    )).rows[0];
    assert.ok(replacement);
    assert.notEqual(replacement.id, booking.id);
    await db.query(
      "INSERT INTO queue_entries(booking_id,customer_id,service_id,barber_id,status) VALUES($1,$2,$3,$4,'ready')",
      [replacement.id, replacement.customer_id, replacement.service_id, replacement.barber_id],
    );
    await runSeed();
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM queue_entries")).rows[0].count), 0);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings WHERE demo_key IS NOT NULL")).rows[0].count), 4);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM users WHERE email='seed-admin@test.local' AND deleted_at IS NULL")).rows[0].count), 1);
  } finally {
    await cleanup();
  }
});
