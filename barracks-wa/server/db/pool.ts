import { Pool } from "pg";

const ssl = process.env.DATABASE_SSL === "true"
  ? { rejectUnauthorized: false }
  : undefined;
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or POSTGRES_URL must be configured");
}

// Next development reloads and route bundles must share one connection pool.
const databaseGlobal = globalThis as typeof globalThis & { barracksDatabasePool?: Pool };
const existingPool = databaseGlobal.barracksDatabasePool;
export const pool = existingPool ?? new Pool({
  connectionString,
  ssl,
  max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
});

if (process.env.NODE_ENV !== "production") databaseGlobal.barracksDatabasePool = pool;
if (!existingPool) pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
