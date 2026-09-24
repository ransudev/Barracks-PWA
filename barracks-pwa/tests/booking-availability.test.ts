import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { calculateSlots, getBookingAvailability, isBookingSlotAvailable, overlaps } from "@/server/services/booking-availability.service";
import { weeklyScheduleSchema, unavailabilitySchema, hoursSchema } from "@/server/schemas/schedule.schema";

const date = "2026-10-05";
const now = new Date("2026-10-04T00:00:00Z");
const hours = { dayOfWeek: 1, openTime: "09:00", closeTime: "19:30", isClosed: false };
const schedule = { dayOfWeek: 1, isWorking: true, startTime: "09:00", endTime: "19:30", breaks: [] as { startTime: string; endTime: string }[] };
const slots = (overrides: Partial<Parameters<typeof calculateSlots>[0]> = {}) => calculateSlots({ date, durationMinutes: 45, hours, schedule, now, ...overrides });
const starts = (overrides: Partial<Parameters<typeof calculateSlots>[0]> = {}) => slots(overrides).map((slot) => slot.startTime);

test("shop open hours and boundaries", () => {
  assert.equal(starts()[0], "09:00");
  assert.equal(slots().at(-1)?.endTime, "19:30");
  assert.equal(starts().includes("08:45"), false);
  assert.equal(starts().includes("19:30"), false);
  assert.equal(starts().includes("19:00"), false); // service would finish after closing
  assert.deepEqual(starts({ hours: { ...hours, isClosed: true } }), []);
});

test("barber off day and shift boundaries", () => {
  assert.deepEqual(starts({ schedule: { ...schedule, isWorking: false } }), []);
  const restricted = { ...schedule, startTime: "10:00", endTime: "17:00" };
  assert.equal(starts({ schedule: restricted })[0], "10:00");
  assert.equal(starts({ schedule: restricted }).includes("09:45"), false);
  assert.equal(starts({ schedule: restricted }).includes("16:30"), false);
  assert.equal(slots({ schedule: restricted }).at(-1)?.endTime, "17:00");
});

test("break, temporary absence and booking overlap use half-open intervals", () => {
  assert.equal(starts({ schedule: { ...schedule, breaks: [{ startTime: "12:00", endTime: "13:00" }] } }).includes("11:30"), false);
  assert.equal(starts({ schedule: { ...schedule, breaks: [{ startTime: "12:00", endTime: "13:00" }] } }).includes("13:00"), true);
  assert.equal(starts({ blocks: [{ start: 14 * 60, end: 15 * 60 }] }).includes("13:30"), false);
  assert.equal(starts({ blocks: [{ start: 14 * 60, end: 15 * 60 }] }).includes("15:00"), true);
  assert.equal(overlaps({ start: 645, end: 690 }, { start: 600, end: 645 }), false);
  assert.equal(starts({ blocks: [{ start: 600, end: 645 }] }).includes("10:45"), true);
});

test("past slots today are removed in Philippine time", () => {
  const today = "2026-10-05";
  const result = starts({ date: today, now: new Date("2026-10-05T02:00:00Z") });
  assert.equal(result.includes("10:00"), false);
  assert.equal(result.includes("10:15"), true);
});

test("invalid hours, breaks and absences are rejected", () => {
  assert.equal(hoursSchema.safeParse({ ...hours, closeTime: "08:00" }).success, false);
  assert.equal(weeklyScheduleSchema.safeParse({ ...schedule, breaks: [{ startTime: "08:30", endTime: "09:30" }] }).success, false);
  assert.equal(weeklyScheduleSchema.safeParse({ ...schedule, breaks: [{ startTime: "12:00", endTime: "12:30" }, { startTime: "12:15", endTime: "12:45" }] }).success, false);
  assert.equal(unavailabilitySchema.safeParse({ startsAt: "2026-10-05T12:00:00+08:00", endsAt: "2026-10-05T11:00:00+08:00", reason: "Leave" }).success, false);
});

function fakeDatabase(status: string, booking = false): Pool {
  return { query: async (sql: string) => {
    if (sql.includes("FROM services")) return { rows: [{ id: "cut", name: "Cut", description: "", current_price: "100", duration_minutes: 45, active: true, created_at: new Date(), updated_at: new Date() }] };
    if (sql.includes("FROM barbers")) return { rows: [{ id: 1, first_name: "A", last_name: "B", status, commission_rate: null, services_done: 0, revenue: 0, rating: null, created_at: new Date(), updated_at: new Date() }] };
    if (sql.includes("FROM shop_operating_hours")) return { rows: [{ day_of_week: 1, open_time: "09:00:00", close_time: "19:30:00", is_closed: false }] };
    if (sql.includes("FROM barber_schedules")) return { rows: [{ id: 1, day_of_week: 1, is_working: true, start_time: "09:00:00", end_time: "19:30:00" }] };
    if (sql.includes("FROM barber_schedule_breaks")) return { rows: [] };
    if (sql.includes("FROM barber_unavailability")) return { rows: [] };
    if (sql.includes("FROM bookings")) return { rows: booking ? [{ booking_time: "10:00:00", end_time: "10:45:00", service_duration_minutes: 45 }] : [] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as Pool;
}

test("globally unavailable barber has no slots, while busy status remains schedulable", async () => {
  const input = { serviceId: "cut", barberId: 1, date };
  assert.deepEqual((await getBookingAvailability(fakeDatabase("unavailable"), input, { now })).slots, []);
  assert.equal((await getBookingAvailability(fakeDatabase("busy"), input, { now })).slots.length > 0, true);
});

test("active bookings block overlaps and reusable selected-slot validation allows back-to-back", async () => {
  const db = fakeDatabase("available", true);
  const input = { serviceId: "cut", barberId: 1, date };
  assert.equal(await isBookingSlotAvailable(db, { ...input, time: "10:15" }, { now }), false);
  assert.equal(await isBookingSlotAvailable(db, { ...input, time: "10:45" }, { now }), true);
});
