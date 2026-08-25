import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "../server/db/pool";

const migrationPath = fileURLToPath(
  new URL("../server/db/migrations/001_user_management.sql", import.meta.url),
);

async function migrate() {
  const migration = await readFile(migrationPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migration);
    await client.query("COMMIT");
    console.log("User management database migration applied");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
