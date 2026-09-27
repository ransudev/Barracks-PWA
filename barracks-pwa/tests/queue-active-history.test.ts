import assert from "node:assert/strict";
import test from "node:test";
import { listQueue } from "@/server/services/queue.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("queue views filter at Manila midnight and retain active joined order", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const client = await db.connect();
  try {
    const barber = (await client.query<{ id: number }>(
      "INSERT INTO barbers(first_name,last_name) VALUES('Queue','Barber') RETURNING id",
    )).rows[0].id;
    const customer = (await client.query<{ id: number }>(
      "INSERT INTO customers(first_name,last_name) VALUES('Queue','Customer') RETURNING id",
    )).rows[0].id;
    const midnightEpoch = (await client.query<{ epoch: number }>(
      "SELECT EXTRACT(EPOCH FROM ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date::timestamp AT TIME ZONE 'Asia/Manila'))::double precision AS epoch",
    )).rows[0].epoch;
    const midnight = new Date(midnightEpoch * 1000);
    const at = (minutes: number) => new Date(midnight.getTime() + minutes * 60_000);
    async function insert(status: string, joined: Date, started: Date | null = null, completed: Date | null = null) {
      return Number((await client.query<{ id: number }>(
        `INSERT INTO queue_entries(customer_id,service_id,barber_id,status,joined_at,started_at,completed_at)
         VALUES($1,'barracks-basic',$2,$3,$4,$5,$6) RETURNING id`,
        [customer, status === "waiting" || status === "removed" ? null : barber, status, joined, started, completed],
      )).rows[0].id);
    }
    const newer = await insert("waiting", at(20));
    const ready = await insert("ready", at(10));
    const serving = await insert("in_progress", at(15), at(16));
    const older = await insert("waiting", at(10));
    const yesterday = await insert("completed", at(-30), at(-20), at(-1));
    const todayStart = await insert("completed", at(-2), at(-1), at(0));
    const todayEnd = await insert("completed", at(1430), at(1435), at(1439));
    const tomorrow = await insert("completed", at(1440), at(1440), at(1441));
    await insert("removed", at(5));

    // Session timezone cannot alter the shop's local-day interpretation.
    await client.query("SET TIME ZONE 'America/Los_Angeles'");
    assert.deepEqual((await listQueue(client)).map((entry) => entry.id), [ready, older, serving, newer]);
    assert.deepEqual((await listQueue(client, "completed-today")).map((entry) => entry.id), [todayStart, todayEnd]);
    assert.ok(!(await listQueue(client, "completed-today")).some((entry) => [yesterday, tomorrow].includes(entry.id)));
  } finally { client.release(); await cleanup(); }
});
