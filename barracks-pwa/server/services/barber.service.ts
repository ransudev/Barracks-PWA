import type { Pool, PoolClient } from "pg";
import { inTransaction, type Db } from "@/server/db/transaction";
import type { BarberInput, BarberStaffInput } from "@/server/schemas/sprint.schema";

type BarberRow = {
  id: number;
  branch_id: number;
  first_name: string;
  last_name: string;
  status: "available" | "busy" | "unavailable";
  commission_rate: number | string | null;
  services_done: number | string;
  revenue: number | string;
  rating: number | string | null;
  schedule_day_count: number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type BarberRecord = {
  id: number;
  branchId: number;
  firstName: string;
  lastName: string;
  status: BarberRow["status"];
  commissionRate: number | null;
  servicesDone: number;
  revenue: number;
  rating: number | null;
  scheduleDayCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BarberAvailabilityRecord = Pick<BarberRecord, "branchId" | "id" | "firstName" | "lastName" | "status">;

type BarberAvailabilityRow = Pick<BarberRow, "branch_id" | "id" | "first_name" | "last_name" | "status">;

export type BarberDeleteResult = "deleted" | "not_found" | "referenced";

const barberSelect = `
  SELECT id, branch_id, first_name, last_name, status, commission_rate, services_done, revenue, rating, created_at, updated_at,
    (SELECT COUNT(*) FROM barber_schedules s WHERE s.barber_id = barbers.id) AS schedule_day_count
  FROM barbers
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBarber(row: BarberRow): BarberRecord {
  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    commissionRate: row.commission_rate === null ? null : Number(row.commission_rate),
    servicesDone: Number(row.services_done),
    revenue: Number(row.revenue),
    rating: row.rating === null ? null : Number(row.rating),
    scheduleDayCount: Number(row.schedule_day_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBarbers(db: Db, branchIds?: number[]): Promise<BarberRecord[]> {
  const result = await db.query<BarberRow>(
    `${barberSelect} ${branchIds ? "WHERE branch_id = ANY($1::int[])" : ""} ORDER BY first_name ASC, last_name ASC, id ASC`,
    branchIds ? [branchIds] : [],
  );
  return result.rows.map(toBarber);
}

export async function listBarberAvailability(db: Db, branchIds?: number[]): Promise<BarberAvailabilityRecord[]> {
  const result = await db.query<BarberAvailabilityRow>(
    `
      SELECT id, branch_id, first_name, last_name, status
      FROM barbers
      ${branchIds ? "WHERE branch_id = ANY($1::int[])" : ""}
      ORDER BY first_name ASC, last_name ASC, id ASC
    `, branchIds ? [branchIds] : [],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    branchId: Number(row.branch_id),
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
  }));
}

export async function findBarberById(db: Pool | PoolClient, id: number): Promise<BarberRecord | null> {
  const result = await db.query<BarberRow>(`${barberSelect} WHERE id = $1`, [id]);
  return result.rows[0] ? toBarber(result.rows[0]) : null;
}

type BarberMutationInput = BarberInput | BarberStaffInput;

export async function createBarber(db: Db, input: BarberMutationInput): Promise<BarberRecord> {
  const commissionRate = "commissionRate" in input ? input.commissionRate : null;
  const rating = "rating" in input ? input.rating : null;
  return inTransaction(db, async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO barbers (first_name, last_name, status, commission_rate, rating, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.firstName, input.lastName, input.status, commissionRate, rating ?? null, input.branchId],
    );
    const id = inserted.rows[0].id;
    const scheduled = await client.query(
      `INSERT INTO barber_schedules (barber_id, day_of_week, is_working, start_time, end_time)
       SELECT $1, day_of_week, NOT is_closed, open_time, close_time FROM shop_operating_hours WHERE branch_id=$2
       RETURNING day_of_week`, [id, input.branchId],
    );
    if (scheduled.rowCount !== 7) throw new Error("Configure all seven shop days before adding a barber");
    return (await findBarberById(client, id)) as BarberRecord;
  });
}

export async function updateBarber(
  db: Db,
  id: number,
  input: BarberMutationInput,
): Promise<BarberRecord | null> {
  const values: Array<string | number | null> = [input.firstName, input.lastName, input.status, input.branchId];
  const updates = ["first_name = $1", "last_name = $2", "status = $3", "branch_id = $4"];
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

export async function updateBarberStatus(
  db: Db,
  id: number,
  status: BarberAvailabilityRecord["status"],
): Promise<BarberAvailabilityRecord | null> {
  const result = await db.query<BarberAvailabilityRow>(
    `UPDATE barbers SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, branch_id, first_name, last_name, status`,
    [status, id],
  );
  const row = result.rows[0];
  return row ? { id: Number(row.id),
    branchId: Number(row.branch_id), firstName: row.first_name, lastName: row.last_name, status: row.status } : null;
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
