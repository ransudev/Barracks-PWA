import { Pool } from "pg";

const ssl = process.env.DATABASE_SSL === "true"
  ? { rejectUnauthorized: false }
  : undefined;
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or POSTGRES_URL must be configured");
}

export const pool = new Pool({
  connectionString,
  ssl,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
