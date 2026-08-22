import { Pool } from "pg";

const ssl = process.env.DATABASE_SSL === "true"
  ? { rejectUnauthorized: false }
  : undefined;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
