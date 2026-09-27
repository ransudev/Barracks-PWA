import type { Pool, PoolClient } from "pg";
import { listBarberSchedules, listBarberUnavailability, listShopHours } from "@/server/services/schedule.service";

type Db = Pool | PoolClient;
export type OperationalReason = "barber_not_found" | "unavailable" | "serving_customer" | "off_shift" | "break" | "temporary_unavailability";
export type OperationalAvailability = { available: boolean; reason: OperationalReason | null; activeQueueEntryId: number | null };

const allowed: OperationalAvailability = { available: true, reason: null, activeQueueEntryId: null };
const blocked = (reason: OperationalReason, activeQueueEntryId: number | null = null): OperationalAvailability =>
  ({ available: false, reason, activeQueueEntryId });

// Call inside the queue/booking transaction after locking the barber row. The
// partial unique index remains the database-level arbiter for concurrent starts.
export async function getBarberOperationalAvailability(db: Db, barberId: number): Promise<OperationalAvailability> {
  const barber = await db.query<{ status: "available" | "busy" | "unavailable" }>("SELECT status FROM barbers WHERE id=$1", [barberId]);
  if (!barber.rows[0]) return blocked("barber_not_found");
  if (barber.rows[0].status === "unavailable") return blocked("unavailable");

  const active = await db.query<{ id: number }>(
    "SELECT id FROM queue_entries WHERE barber_id=$1 AND status='in_progress' LIMIT 1", [barberId]);
  if (active.rows[0]) return blocked("serving_customer", Number(active.rows[0].id));

  const clock = await db.query<{ instant: Date; local_time: string; weekday: number }>(
    `WITH clock AS (SELECT clock_timestamp() AS instant)
     SELECT instant, (instant AT TIME ZONE 'Asia/Manila')::time::text AS local_time,
       EXTRACT(DOW FROM instant AT TIME ZONE 'Asia/Manila')::integer AS weekday FROM clock`);
  const { instant, local_time: localTime, weekday } = clock.rows[0];
  // A PoolClient runs one query at a time; issue these reads in sequence.
  const hours = await listShopHours(db);
  const schedules = await listBarberSchedules(db, barberId);
  const absences = await listBarberUnavailability(db, barberId, instant.toISOString(), new Date(instant.getTime() + 1).toISOString());
  const shop = hours.find((day) => day.dayOfWeek === weekday);
  const shift = schedules.find((day) => day.dayOfWeek === weekday);
  if (!shop || shop.isClosed || !shift?.isWorking || localTime < shop.openTime || localTime >= shop.closeTime ||
      localTime < shift.startTime || localTime >= shift.endTime) return blocked("off_shift");
  if (shift.breaks.some((item) => localTime >= item.startTime && localTime < item.endTime)) return blocked("break");
  if (absences.some((item) => Date.parse(item.startsAt) <= instant.getTime() && Date.parse(item.endsAt) > instant.getTime()))
    return blocked("temporary_unavailability");
  return allowed;
}

export function requireBarberOperationalAvailability(result: OperationalAvailability): void {
  if (result.available) return;
  const messages: Record<OperationalReason, string> = {
    barber_not_found: "Barber not found.", unavailable: "Barber is unavailable.",
    serving_customer: "Barber is currently serving another customer.",
    off_shift: "Barber is not scheduled to work at this time.",
    break: "Barber is currently on a scheduled break.",
    temporary_unavailability: "Barber is temporarily unavailable.",
  };
  throw new BarberOperationalAvailabilityError(messages[result.reason!]);
}

export class BarberOperationalAvailabilityError extends Error {}
