import type { Pool } from "pg";
import type { BarberInput } from "@/server/schemas/sprint.schema";

type BarberRow = {
  id: number;
  first_name: string;
  last_name: string;
  specialty: string;
  status: "available" | "busy" | "unavailable";
  commission_rate: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type BarberRecord = {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  status: BarberRow["status"];
  commissionRate: number | null;
  createdAt: string;
  updatedAt: string;
};

const barberSelect = `
  SELECT id, first_name, last_name, specialty, status, commission_rate, created_at, updated_at
  FROM barbers
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBarber(row: BarberRow): BarberRecord {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    specialty: row.specialty,
    status: row.status,
    commissionRate: row.commission_rate === null ? null : Number(row.commission_rate),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBarbers(db: Pool): Promise<BarberRecord[]> {
  const result = await db.query<BarberRow>(
    `${barberSelect} ORDER BY first_name ASC, last_name ASC, id ASC`,
  );
  return result.rows.map(toBarber);
}

export async function findBarberById(db: Pool, id: number): Promise<BarberRecord | null> {
  const result = await db.query<BarberRow>(`${barberSelect} WHERE id = $1`, [id]);
  return result.rows[0] ? toBarber(result.rows[0]) : null;
}

export async function createBarber(db: Pool, input: BarberInput): Promise<BarberRecord> {
  const result = await db.query<{ id: number }>(
    `
      INSERT INTO barbers (first_name, last_name, specialty, status, commission_rate)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.firstName, input.lastName, input.specialty, input.status, input.commissionRate],
  );
  return (await findBarberById(db, result.rows[0].id)) as BarberRecord;
}

export async function updateBarber(
  db: Pool,
  id: number,
  input: BarberInput,
): Promise<BarberRecord | null> {
  const result = await db.query<{ id: number }>(
    `
      UPDATE barbers
      SET first_name = $1, last_name = $2, specialty = $3, status = $4,
          commission_rate = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id
    `,
    [input.firstName, input.lastName, input.specialty, input.status, input.commissionRate, id],
  );
  return result.rows[0] ? findBarberById(db, id) : null;
}

export async function deleteBarber(db: Pool, id: number): Promise<boolean> {
  const result = await db.query("DELETE FROM barbers WHERE id = $1", [id]);
  return Boolean(result.rowCount);
}
