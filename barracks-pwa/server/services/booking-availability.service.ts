import type { Pool } from "pg";
import { findServiceById } from "@/server/services/service.service";
import { findBarberById } from "@/server/services/barber.service";
import { listBarberSchedules, listBarberUnavailability, listShopHours, type ShopHours, type WeeklySchedule } from "@/server/services/schedule.service";

export type AvailabilitySlot = { startTime: string; endTime: string };
export type AvailabilityResult = { date: string; durationMinutes: number; slots: AvailabilitySlot[] };
export type BlockedInterval = { start: number; end: number };

export function minuteOfDay(time: string): number { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
function clock(minute: number): string { return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
export function overlaps(a: BlockedInterval, b: BlockedInterval): boolean { return a.start < b.end && a.end > b.start; }
export function calculateSlots(input: { date: string; durationMinutes: number; hours?: ShopHours; schedule?: WeeklySchedule; blocks?: BlockedInterval[]; now?: Date }): AvailabilitySlot[] {
  const { date, durationMinutes, hours, schedule, blocks = [], now = new Date() } = input;
  if (!hours || hours.isClosed || !schedule?.isWorking || durationMinutes <= 0) return [];
  const open = Math.max(minuteOfDay(hours.openTime), minuteOfDay(schedule.startTime));
  const close = Math.min(minuteOfDay(hours.closeTime), minuteOfDay(schedule.endTime));
  const nowMs = now.getTime();
  const slots: AvailabilitySlot[] = [];
  for (let start = Math.ceil(open / 15) * 15; start + durationMinutes <= close; start += 15) {
    const end = start + durationMinutes;
    const instant = Date.parse(`${date}T00:00:00+08:00`) + start * 60_000;
    if (instant <= nowMs) continue;
    const candidate = { start, end };
    if (schedule.breaks.some((item) => overlaps(candidate, { start: minuteOfDay(item.startTime), end: minuteOfDay(item.endTime) }))) continue;
    if (blocks.some((item) => overlaps(candidate, item))) continue;
    slots.push({ startTime: clock(start), endTime: clock(end) });
  }
  return slots;
}

export class AvailabilityError extends Error {
  constructor(public readonly kind: "service_not_found" | "barber_not_found", message: string) { super(message); }
}

export async function getBookingAvailability(db: Pool, input: { serviceId: string; barberId: number; date: string }, options: { now?: Date; excludeBookingId?: number } = {}): Promise<AvailabilityResult> {
  const service = await findServiceById(db, input.serviceId);
  if (!service?.active || !service.durationMinutes) throw new AvailabilityError("service_not_found", "Service is not available");
  const barber = await findBarberById(db, input.barberId);
  if (!barber) throw new AvailabilityError("barber_not_found", "Barber not found");
  const empty = { date: input.date, durationMinutes: service.durationMinutes, slots: [] };
  if (barber.status === "unavailable") return empty;
  const weekday = new Date(`${input.date}T00:00:00Z`).getUTCDay();
  const [hours, schedules, absence, bookings] = await Promise.all([
    listShopHours(db), listBarberSchedules(db, input.barberId),
    listBarberUnavailability(db, input.barberId, `${input.date}T00:00:00+08:00`, new Date(Date.parse(`${input.date}T00:00:00+08:00`) + 86_400_000).toISOString()),
    db.query<{ booking_time: string; end_time: string | null; service_duration_minutes: number | null }>(
      `SELECT booking_time, end_time, service_duration_minutes FROM bookings WHERE barber_id=$1 AND booking_date=$2
       AND status IN ('confirmed','checked_in','in_progress') AND ($3::bigint IS NULL OR id<>$3)`,
      [input.barberId, input.date, options.excludeBookingId ?? null]),
  ]);
  const midnight = Date.parse(`${input.date}T00:00:00+08:00`);
  const blocks: BlockedInterval[] = absence.map((item) => ({ start: (Date.parse(item.startsAt) - midnight) / 60_000, end: (Date.parse(item.endsAt) - midnight) / 60_000 }));
  for (const row of bookings.rows) {
    const start = minuteOfDay(row.booking_time);
    // Legacy bookings without a known duration conservatively block the day.
    blocks.push({ start: row.end_time || row.service_duration_minutes ? start : 0, end: row.end_time ? minuteOfDay(row.end_time) : row.service_duration_minutes ? start + row.service_duration_minutes : 1440 });
  }
  return { ...empty, slots: calculateSlots({ date: input.date, durationMinutes: service.durationMinutes, hours: hours.find((item) => item.dayOfWeek === weekday), schedule: schedules.find((item) => item.dayOfWeek === weekday), blocks, now: options.now }) };
}

export async function isBookingSlotAvailable(db: Pool, input: { serviceId: string; barberId: number; date: string; time: string }, options: { now?: Date; excludeBookingId?: number } = {}): Promise<boolean> {
  const result = await getBookingAvailability(db, input, options);
  return result.slots.some((slot) => slot.startTime === input.time);
}
