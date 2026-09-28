import type { Pool, PoolClient } from "pg";
import type { ServiceInput, ServiceUpdateInput } from "@/server/schemas/service.schema";

type ServiceRow = { id: string; name: string; description: string; current_price: string; duration_minutes: number | null; active: boolean; created_at: Date; updated_at: Date };
export type ServiceRecord = { id: string; name: string; description: string; price: number; durationMinutes: number | null; active: boolean; createdAt: string; updatedAt: string };
const columns = "id, name, description, current_price, duration_minutes, active, created_at, updated_at";
function map(row: ServiceRow): ServiceRecord {
  return { id: row.id, name: row.name, description: row.description, price: Number(row.current_price), durationMinutes: row.duration_minutes, active: row.active, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function listServices(db: Pool, activeOnly = false): Promise<ServiceRecord[]> {
  const result = await db.query<ServiceRow>(`SELECT ${columns} FROM services ${activeOnly ? "WHERE active = TRUE" : ""} ORDER BY name`);
  return result.rows.map(map);
}
export async function findServiceById(db: Pool | PoolClient, id: string): Promise<ServiceRecord | null> {
  const result = await db.query<ServiceRow>(`SELECT ${columns} FROM services WHERE id = $1`, [id]);
  return result.rows[0] ? map(result.rows[0]) : null;
}
export async function createService(db: Pool, input: ServiceInput): Promise<ServiceRecord> {
  const result = await db.query<ServiceRow>(`INSERT INTO services (id, name, description, current_price, duration_minutes, active)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${columns}`, [input.id, input.name, input.description, input.price, input.durationMinutes, input.active]);
  return map(result.rows[0]);
}
export async function updateService(db: Pool, id: string, input: ServiceUpdateInput): Promise<ServiceRecord | null> {
  const existing = await findServiceById(db, id);
  if (!existing) return null;
  if (input.active === true && !(input.durationMinutes ?? existing.durationMinutes)) {
    throw new Error("Set a positive duration before enabling this service");
  }
  const result = await db.query<ServiceRow>(`UPDATE services SET name=$2, description=$3, current_price=$4,
    duration_minutes=$5, active=$6, updated_at=NOW() WHERE id=$1 RETURNING ${columns}`,
    [id, input.name ?? existing.name, input.description ?? existing.description, input.price ?? existing.price,
      input.durationMinutes ?? existing.durationMinutes, input.active ?? existing.active]);
  return map(result.rows[0]);
}
