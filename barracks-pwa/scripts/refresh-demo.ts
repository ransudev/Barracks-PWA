import { readFile } from "node:fs/promises";
import { pool } from "../server/db/pool";

const client = await pool.connect();
try {
  const sql = await readFile(new URL("./refresh-demo.sql", import.meta.url), "utf8");
  await client.query(sql);
  console.log("Demo refreshed: branch stock/restocks, upcoming bookings, attendance, and waiting queue. Existing accounts and financial history preserved.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Demo refresh failed", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
