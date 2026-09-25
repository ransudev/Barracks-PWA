import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { applyMigrations } from "@/server/db/migrate";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

export const databaseConfigured = Boolean(connectionString);

export async function createDisposableSchema(through = Number.POSITIVE_INFINITY) {
  if (!connectionString) throw new Error("DATABASE_URL or POSTGRES_URL is required for database tests");
  const schema = `codex_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString, ssl, max: 2 });
  const db = new Pool({ connectionString, ssl, options: `-c search_path=${schema},public`, max: 10 });
  try {
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
    cleanup: async () => {
      await db.end();
      try { await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await admin.end(); }
    },
  };
}
