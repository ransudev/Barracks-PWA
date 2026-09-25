import { pool } from "../server/db/pool";
import { applyMigrations } from "../server/db/migrate";

try {
  await applyMigrations(pool);
  console.log("Database migrations are up to date");
} catch (error) {
  console.error("Database migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
