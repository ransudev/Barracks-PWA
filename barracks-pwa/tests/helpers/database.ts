import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { applyMigrations } from "@/server/db/migrate";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

export const databaseConfigured = Boolean(connectionString);

export async function createDisposableSchema(through = Number.POSITIVE_INFINITY) {
  if (!connectionString) throw new Error("DATABASE_URL or POSTGRES_URL is required for database tests");
  const target = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    || !/^\/barracks_[a-z0-9_]*disposable$/.test(target.pathname)
    || process.env.DATABASE_SSL === "true") {
    throw new Error("Database tests require a local barracks_*disposable database with DATABASE_SSL=false; hosted targets are forbidden");
  }
  const schema = `codex_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString, ssl, max: 2 });
  const db = new Pool({ connectionString, ssl, options: `-c search_path=${schema},public`, max: 10 });
  try {
    // Extensions are database-wide. Never let the first disposable schema own
    // btree_gist, since dropping it would invalidate other schema fixtures.
    const setup = await admin.connect();
    try {
      await setup.query("BEGIN");
      await setup.query("SELECT pg_advisory_xact_lock(918274)");
      await setup.query("CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public");
      await setup.query("ALTER EXTENSION btree_gist SET SCHEMA public");
      await setup.query("COMMIT");
    } catch (error) {
      await setup.query("ROLLBACK");
      throw error;
    } finally { setup.release(); }
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await applyMigrations(db, through);
  } catch (error) {
    await db.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }
  return {
    db,
    schema,
    cleanup: async () => {
      await db.end();
      try { await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await admin.end(); }
    },
  };
}
