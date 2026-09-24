import type { Pool } from "pg";
import type { z } from "zod";
import { hoursSchema, weeklyScheduleSchema, unavailabilitySchema } from "@/server/schemas/schedule.schema";

export type ShopHours = z.infer<typeof hoursSchema>;
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;
export type UnavailabilityInput = z.infer<typeof unavailabilitySchema>;
export type Unavailability = UnavailabilityInput & { id: number };

export async function listShopHours(db: Pool): Promise<ShopHours[]> {
  const result = await db.query<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }>(
    "SELECT day_of_week, open_time, close_time, is_closed FROM shop_operating_hours ORDER BY day_of_week",
  );
  return result.rows.map((row) => ({ dayOfWeek: row.day_of_week, openTime: row.open_time.slice(0, 5), closeTime: row.close_time.slice(0, 5), isClosed: row.is_closed }));
}

export async function saveShopHours(db: Pool, input: ShopHours): Promise<ShopHours[]> {
  hoursSchema.parse(input);
  await db.query("UPDATE shop_operating_hours SET open_time=$2, close_time=$3, is_closed=$4, updated_at=NOW() WHERE day_of_week=$1", [input.dayOfWeek, input.openTime, input.closeTime, input.isClosed]);
  return listShopHours(db);
}

export async function listBarberSchedules(db: Pool, barberId: number): Promise<WeeklySchedule[]> {
  const schedules = await db.query<{ id: number; day_of_week: number; is_working: boolean; start_time: string; end_time: string }>(
    "SELECT id, day_of_week, is_working, start_time, end_time FROM barber_schedules WHERE barber_id=$1 ORDER BY day_of_week", [barberId],
  );
  const breaks = await db.query<{ barber_schedule_id: number; start_time: string; end_time: string }>(
    "SELECT b.barber_schedule_id, b.start_time, b.end_time FROM barber_schedule_breaks b JOIN barber_schedules s ON s.id=b.barber_schedule_id WHERE s.barber_id=$1 ORDER BY b.start_time", [barberId],
  );
  return schedules.rows.map((row) => ({ dayOfWeek: row.day_of_week, isWorking: row.is_working, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5), breaks: breaks.rows.filter((item) => item.barber_schedule_id === row.id).map((item) => ({ startTime: item.start_time.slice(0, 5), endTime: item.end_time.slice(0, 5) })) }));
}

export async function saveBarberSchedule(db: Pool, barberId: number, input: WeeklySchedule): Promise<WeeklySchedule[]> {
  weeklyScheduleSchema.parse(input);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const barber = await client.query("SELECT id FROM barbers WHERE id=$1 FOR UPDATE", [barberId]);
    if (!barber.rowCount) throw new Error("Barber not found");
    const result = await client.query<{ id: number }>(`INSERT INTO barber_schedules (barber_id, day_of_week, is_working, start_time, end_time)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (barber_id,day_of_week) DO UPDATE SET is_working=$3,start_time=$4,end_time=$5,updated_at=NOW() RETURNING id`,
    [barberId, input.dayOfWeek, input.isWorking, input.startTime, input.endTime]);
    await client.query("DELETE FROM barber_schedule_breaks WHERE barber_schedule_id=$1", [result.rows[0].id]);
    for (const item of input.breaks) await client.query("INSERT INTO barber_schedule_breaks (barber_schedule_id,start_time,end_time) VALUES ($1,$2,$3)", [result.rows[0].id, item.startTime, item.endTime]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
  return listBarberSchedules(db, barberId);
}

export async function listBarberUnavailability(db: Pool, barberId: number, from?: string, to?: string): Promise<Unavailability[]> {
  const result = await db.query<{ id: number; starts_at: Date; ends_at: Date; reason: string }>(
    `SELECT id, starts_at, ends_at, reason FROM barber_unavailability WHERE barber_id=$1
      AND ($2::timestamptz IS NULL OR ends_at > $2) AND ($3::timestamptz IS NULL OR starts_at < $3) ORDER BY starts_at`,
    [barberId, from ?? null, to ?? null]);
  return result.rows.map((row) => ({ id: row.id, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(), reason: row.reason }));
}

export async function addBarberUnavailability(db: Pool, barberId: number, input: UnavailabilityInput): Promise<Unavailability> {
  unavailabilitySchema.parse(input);
  const result = await db.query<{ id: number }>(`INSERT INTO barber_unavailability (barber_id,starts_at,ends_at,reason)
    SELECT id,$2,$3,$4 FROM barbers WHERE id=$1 RETURNING id`, [barberId, input.startsAt, input.endsAt, input.reason]);
  if (!result.rows[0]) throw new Error("Barber not found");
  return { id: result.rows[0].id, ...input };
}

export async function removeBarberUnavailability(db: Pool, barberId: number, id: number): Promise<boolean> {
  const result = await db.query("DELETE FROM barber_unavailability WHERE barber_id=$1 AND id=$2", [barberId, id]);
  return Boolean(result.rowCount);
}
