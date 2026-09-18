import type { Pool } from "pg";
import type { BarberInput, BarberStaffInput } from "@/server/schemas/sprint.schema";

type BarberRow = {
  id: number;
  first_name: string;
  last_name: string;
  status: "available" | "busy" | "unavailable";
  commission_rate: number | string | null;
  services_done: number | string;
  revenue: number | string;
  rating: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type BarberRecord = {
  id: number;
  firstName: string;
  lastName: string;
  status: BarberRow["status"];
  commissionRate: number | null;
  servicesDone: number;
  revenue: number;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BarberAvailabilityRecord = Pick<BarberRecord, "id" | "firstName" | "lastName" | "status">;

type BarberAvailabilityRow = Pick<BarberRow, "id" | "first_name" | "last_name" | "status">;

export type BarberDeleteResult = "deleted" | "not_found" | "referenced";

const barberSelect = `
  SELECT id, first_name, last_name, status, commission_rate, services_done, revenue, rating, created_at, updated_at
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
    status: row.status,
    commissionRate: row.commission_rate === null ? null : Number(row.commission_rate),
    servicesDone: Number(row.services_done),
    revenue: Number(row.revenue),
    rating: row.rating === null ? null : Number(row.rating),
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

export async function listBarberAvailability(db: Pool): Promise<BarberAvailabilityRecord[]> {
  const result = await db.query<BarberAvailabilityRow>(
    `
      SELECT id, first_name, last_name, status
      FROM barbers
      ORDER BY first_name ASC, last_name ASC, id ASC
    `,
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
  }));
}

export async function findBarberById(db: Pool, id: number): Promise<BarberRecord | null> {
  const result = await db.query<BarberRow>(`${barberSelect} WHERE id = $1`, [id]);
  return result.rows[0] ? toBarber(result.rows[0]) : null;
}

type BarberMutationInput = BarberInput | BarberStaffInput;

export async function createBarber(db: Pool, input: BarberMutationInput): Promise<BarberRecord> {
  const commissionRate = "commissionRate" in input ? input.commissionRate : null;
  const rating = "rating" in input ? input.rating : null;
  const result = await db.query<{ id: number }>(
      `
      INSERT INTO barbers (first_name, last_name, status, commission_rate, rating)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.firstName, input.lastName, input.status, commissionRate, rating ?? null],
  );
  return (await findBarberById(db, result.rows[0].id)) as BarberRecord;
}

export async function updateBarber(
  db: Pool,
  id: number,
  input: BarberMutationInput,
): Promise<BarberRecord | null> {
  const values: Array<string | number | null> = [input.firstName, input.lastName, input.status];
  const updates = ["first_name = $1", "last_name = $2", "status = $3"];
  const commissionRate = "commissionRate" in input ? input.commissionRate : undefined;
  const rating = "rating" in input ? input.rating : undefined;

  if (commissionRate !== undefined) {
    values.push(commissionRate);
    updates.push(`commission_rate = $${values.length}`);
  }
  if (rating !== undefined) {
    values.push(rating);
    updates.push(`rating = $${values.length}`);
  }

  values.push(id);
  const result = await db.query<{ id: number }>(
    `
      UPDATE barbers
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id
    `,
    values,
  );
  return result.rows[0] ? findBarberById(db, id) : null;
}

export async function updateAllBarberCommissionRates(
  db: Pool,
  commissionRate: number,
): Promise<BarberRecord[]> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE barbers SET commission_rate = $1, updated_at = NOW()",
      [commissionRate],
    );
    const result = await client.query<BarberRow>(
      `${barberSelect} ORDER BY first_name ASC, last_name ASC, id ASC`,
    );
    await client.query("COMMIT");
    return result.rows.map(toBarber);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteBarber(db: Pool, id: number): Promise<BarberDeleteResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM barbers WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return "not_found";
    }

    const references = await client.query<{ id: number }>(
      "SELECT id FROM bookings WHERE barber_id = $1 LIMIT 1",
      [id],
    );
    if (references.rows[0]) {
      await client.query("ROLLBACK");
      return "referenced";
    }

    await client.query("DELETE FROM barbers WHERE id = $1", [id]);
    await client.query("COMMIT");
    return "deleted";
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isForeignKeyViolation(error)) return "referenced";
    throw error;
  } finally {
    client.release();
  }
}

function isForeignKeyViolation(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23503",
  );
}
