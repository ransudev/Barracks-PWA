import { readFile } from "node:fs/promises";
import { pool } from "../server/db/pool";

const client = await pool.connect();
try {
  const sql = await readFile(new URL("./refresh-demo.sql", import.meta.url), "utf8");
  const activity = await readFile(new URL("./working-demo.sql", import.meta.url), "utf8");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query(activity);
  await client.query("COMMIT");
  console.log("Demo refreshed: branch stock/restocks, four weeks of visits and payments, upcoming appointments, attendance history, and today's working queue. Existing records preserved.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Demo refresh failed", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
