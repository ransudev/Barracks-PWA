import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { applyMigrations } from "@/server/db/migrate";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

async function legacyPair(db: Pool, sameBarber: boolean): Promise<number[]> {
  const barbers: number[] = [];
  for (let i = 0; i < (sameBarber ? 1 : 2); i++) {
    const result = await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Legacy','Barber') RETURNING id");
    barbers.push(result.rows[0].id);
  }
  const customers: number[] = [];
  for (let i = 0; i < (sameBarber ? 2 : 1); i++) {
    const user = await db.query<{ id: number }>(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
      VALUES('Legacy','Customer',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id`, [`legacy-${i}@test.local`]);
    const customer = await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user.rows[0].id]);
    customers.push(customer.rows[0].id);
  }
  const ids: number[] = [];
  for (let i = 0; i < 2; i++) {
    const result = await db.query<{ id: number }>(`INSERT INTO bookings
      (customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
      VALUES($1,$2,'barracks-basic','Barracks Basic',300,45,'2030-01-01',$3,$4) RETURNING id`,
      [customers[sameBarber ? i : 0], barbers[sameBarber ? 0 : i], i ? "10:15" : "10:00", i ? "11:00" : "10:45"]);
    ids.push(result.rows[0].id);
  }
  return ids;
}

test("fresh disposable schema applies every migration", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 19);
  } finally { await cleanup(); }
});

test("non-overlapping legacy records migrate and remain intact", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(10);
  try {
    const ids = await legacyPair(db, true);
    await db.query("UPDATE bookings SET booking_time='10:45', end_time='11:30' WHERE id=$1", [ids[1]]);
    await applyMigrations(db);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 19);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings WHERE id=ANY($1::bigint[])", [ids])).rows[0].count), 2);
  } finally { await cleanup(); }
});

test("queue guard migration reports existing active conflicts without changing service state", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(13);
  try {
    const barber = (await db.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Legacy','Queue') RETURNING id")).rows[0].id;
    const customers: number[] = [];
    for (let i = 0; i < 2; i++) {
      const user = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Legacy','Queue',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id", [`legacy-queue-${i}@test.local`])).rows[0].id;
      customers.push((await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user])).rows[0].id);
    }
    const ids: number[] = [];
    for (const customer of customers) ids.push(Number((await db.query<{ id: number }>(
      "INSERT INTO queue_entries(customer_id,service_id,barber_id,status) VALUES($1,'barracks-basic',$2,'in_progress') RETURNING id", [customer, barber])).rows[0].id));
    await assert.rejects(applyMigrations(db, 14), (error: unknown) => error instanceof Error && error.message.includes(`${ids[0]}/${ids[1]}`));
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 13);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM queue_entries WHERE status='in_progress'")).rows[0].count), 2);
    await db.query("UPDATE queue_entries SET status='completed' WHERE id=$1", [ids[0]]);
    await applyMigrations(db, 14);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 14);
  } finally { await cleanup(); }
});

test("queue lifecycle migration requires review of inconsistent legacy states", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(14);
  try {
    const user = (await db.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Legacy','State','legacy-state@test.local','test',(SELECT id FROM roles WHERE name='customer')) RETURNING id")).rows[0].id;
    const customer = (await db.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [user])).rows[0].id;
    const entry = (await db.query<{ id: number }>("INSERT INTO queue_entries(customer_id,service_id,status) VALUES($1,'barracks-basic','ready') RETURNING id", [customer])).rows[0].id;
    await assert.rejects(applyMigrations(db), { code: "23514" });
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 14);
    assert.equal((await db.query<{ status: string }>("SELECT status FROM queue_entries WHERE id=$1", [entry])).rows[0].status, "ready");
    await db.query("UPDATE queue_entries SET status='waiting' WHERE id=$1", [entry]);
    await applyMigrations(db);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 19);
  } finally { await cleanup(); }
});

for (const sameBarber of [true, false]) {
  test(`legacy ${sameBarber ? "barber" : "customer"} overlap blocks migration without changing records`, { skip: !databaseConfigured }, async () => {
    const { db, cleanup } = await createDisposableSchema(10);
    try {
      const ids = await legacyPair(db, sameBarber);
      await assert.rejects(applyMigrations(db), (error: unknown) =>
        error instanceof Error && error.message.includes(`${ids[0]}/${ids[1]}`) && error.message.includes(sameBarber ? "barber" : "customer"));
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 10);
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings WHERE id=ANY($1::bigint[]) AND status='confirmed'", [ids])).rows[0].count), 2);
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM pg_constraint WHERE conrelid='bookings'::regclass AND conname LIKE 'bookings_active_%_overlap'")).rows[0].count), 0);
      // A reviewer moves the second appointment to the first appointment's end.
      await db.query("UPDATE bookings SET booking_time='10:45', end_time='11:30' WHERE id=$1", [ids[1]]);
      await applyMigrations(db);
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM schema_migrations")).rows[0].count), 19);
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM bookings WHERE id=ANY($1::bigint[]) AND status='confirmed'", [ids])).rows[0].count), 2);
    } finally { await cleanup(); }
  });
}
