import type { Pool } from "pg";
import { findServiceById } from "@/server/services/service.service";
import { findBarberById, listBarberAvailability } from "@/server/services/barber.service";
import { listBarberSchedules, listBarberUnavailability, listShopHours, type ShopHours, type WeeklySchedule } from "@/server/services/schedule.service";

export type AvailabilitySlot = { startTime: string; endTime: string };
export type AvailabilityResult = { date: string; durationMinutes: number; slots: AvailabilitySlot[]; reason?: "schedule_not_configured" };
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

type AvailabilityOptions = { now?: Date; excludeBookingId?: number };
type AvailableBarber = { id: number; status: string };

async function loadContext(db: Pool, serviceId: string, date: string) {
  const [service, hours] = await Promise.all([findServiceById(db, serviceId), listShopHours(db)]);
  if (!service?.active || !service.durationMinutes) throw new AvailabilityError("service_not_found", "Service is not available");
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { durationMinutes: service.durationMinutes, hours: hours.find((item) => item.dayOfWeek === weekday), weekday };
}

async function availabilityForBarber(db: Pool, input: { barberId: number; date: string }, barber: AvailableBarber, context: Awaited<ReturnType<typeof loadContext>>, options: AvailabilityOptions): Promise<AvailabilityResult> {
  const empty: AvailabilityResult = { date: input.date, durationMinutes: context.durationMinutes, slots: [] };
  if (barber.status === "unavailable") return empty;
  const [schedules, absence, bookings] = await Promise.all([
    listBarberSchedules(db, input.barberId),
    listBarberUnavailability(db, input.barberId, `${input.date}T00:00:00+08:00`, new Date(Date.parse(`${input.date}T00:00:00+08:00`) + 86_400_000).toISOString()),
    db.query<{ booking_time: string; end_time: string | null; service_duration_minutes: number | null }>(
      `SELECT booking_time, end_time, service_duration_minutes FROM bookings WHERE barber_id=$1 AND booking_date=$2
       AND status IN ('confirmed','checked_in','in_progress') AND ($3::bigint IS NULL OR id<>$3)`,
      [input.barberId, input.date, options.excludeBookingId ?? null]),
  ]);
  const schedule = schedules.find((item) => item.dayOfWeek === context.weekday);
  if (!schedule) return context.hours && !context.hours.isClosed ? { ...empty, reason: "schedule_not_configured" } : empty;
  const midnight = Date.parse(`${input.date}T00:00:00+08:00`);
  const blocks: BlockedInterval[] = absence.map((item) => ({ start: (Date.parse(item.startsAt) - midnight) / 60_000, end: (Date.parse(item.endsAt) - midnight) / 60_000 }));
  for (const row of bookings.rows) {
    const start = minuteOfDay(row.booking_time);
    // Legacy bookings without a known duration conservatively block the day.
    blocks.push({ start: row.end_time || row.service_duration_minutes ? start : 0, end: row.end_time ? minuteOfDay(row.end_time) : row.service_duration_minutes ? start + row.service_duration_minutes : 1440 });
  }
  return { ...empty, slots: calculateSlots({ date: input.date, durationMinutes: context.durationMinutes, hours: context.hours, schedule, blocks, now: options.now }) };
}

export async function getBookingAvailability(db: Pool, input: { serviceId: string; barberId: number; date: string }, options: AvailabilityOptions = {}): Promise<AvailabilityResult> {
  const [context, barber] = await Promise.all([loadContext(db, input.serviceId, input.date), findBarberById(db, input.barberId)]);
  if (!barber) throw new AvailabilityError("barber_not_found", "Barber not found");
  return availabilityForBarber(db, input, barber, context, options);
}

export async function isBookingSlotAvailable(db: Pool, input: { serviceId: string; barberId: number; date: string; time: string }, options: { now?: Date; excludeBookingId?: number } = {}): Promise<boolean> {
  const result = await getBookingAvailability(db, input, options);
  return result.slots.some((slot) => slot.startTime === input.time);
}

export async function findAvailableBarbers(db: Pool, input: { serviceId: string; date: string; time: string }, options: { now?: Date; excludeBookingId?: number } = {}): Promise<number[]> {
  const [context, allBarbers, counts] = await Promise.all([
    loadContext(db, input.serviceId, input.date),
    listBarberAvailability(db),
    db.query<{ barber_id: number; appointment_count: string }>(
      `SELECT barber_id, COUNT(*) AS appointment_count FROM bookings
       WHERE booking_date=$1 AND status IN ('confirmed','checked_in','in_progress')
       AND ($2::bigint IS NULL OR id<>$2) GROUP BY barber_id`,
      [input.date, options.excludeBookingId ?? null],
    ),
  ]);
  const barbers = allBarbers.filter((barber) => barber.status !== "unavailable");
  const eligible = await Promise.all(barbers.map(async (barber) => ({
    id: barber.id,
    available: (await availabilityForBarber(db, { barberId: barber.id, date: input.date }, barber, context, options)).slots.some((slot) => slot.startTime === input.time),
  })));
  const countByBarber = new Map(counts.rows.map((row) => [Number(row.barber_id), Number(row.appointment_count)]));
  return eligible.filter((barber) => barber.available).map((barber) => barber.id)
    .sort((a, b) => (countByBarber.get(a) ?? 0) - (countByBarber.get(b) ?? 0) || a - b);
}

export async function getAnyBarberAvailability(db: Pool, input: { serviceId: string; date: string }, options: { now?: Date; excludeBookingId?: number } = {}): Promise<AvailabilityResult> {
  const [context, allBarbers] = await Promise.all([loadContext(db, input.serviceId, input.date), listBarberAvailability(db)]);
  const barbers = allBarbers.filter((barber) => barber.status !== "unavailable");
  const results = await Promise.all(barbers.map((barber) => availabilityForBarber(db, { barberId: barber.id, date: input.date }, barber, context, options)));
  const slots = new Map<string, AvailabilitySlot>();
  results.forEach((result) => result.slots.forEach((slot) => slots.set(slot.startTime, slot)));
  return { date: input.date, durationMinutes: context.durationMinutes, slots: [...slots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    ...(barbers.length && results.every((result) => result.reason === "schedule_not_configured") ? { reason: "schedule_not_configured" as const } : {}) };
}
