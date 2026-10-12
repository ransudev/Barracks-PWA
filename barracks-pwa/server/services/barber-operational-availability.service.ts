import type { Pool, PoolClient } from "pg";
import { listBarberSchedules, listBarberUnavailability, listShopHours, ShopHoursConfigurationError, type ShopHours, type WeeklySchedule } from "@/server/services/schedule.service";

type Db = Pool | PoolClient;
export type OperationalReason = "absent" | "clocked_out" | "barber_not_found" | "invalid_branch" | "duration_unknown" | "reservation_collision" | "unavailable" | "serving_customer" | "off_shift" | "break" | "temporary_unavailability";
export type OperationalInterval = { startsAt: string; endsAt: string };
export type OperationalAvailability = { available: boolean; reason: OperationalReason | null; activeQueueEntryId: number | null; interval?: OperationalInterval; attendanceState?: "unmarked" | "present" | "late" | "absent" | "clocked_out" };

const allowed: OperationalAvailability = { available: true, reason: null, activeQueueEntryId: null };
const blocked = (reason: OperationalReason, activeQueueEntryId: number | null = null): OperationalAvailability =>
  ({ available: false, reason, activeQueueEntryId });

// Call inside the queue/booking transaction after locking the barber row. The
// partial unique index remains the database-level arbiter for concurrent starts.
export async function getBarberOperationalAvailability(db: Db, barberId: number, visit?: { durationMinutes: number | null; branchId: number; excludeBookingId?: number }): Promise<OperationalAvailability> {
  const barber = await db.query<{ branch_id: number; status: "available" | "busy" | "unavailable" }>("SELECT status, branch_id FROM barbers WHERE id=$1", [barberId]);
  if (!barber.rows[0]) return blocked("barber_not_found");
  if (visit && Number(barber.rows[0].branch_id) !== visit.branchId) return blocked("invalid_branch");
  if (visit && (!visit.durationMinutes || visit.durationMinutes <= 0)) return blocked("duration_unknown");
  if (barber.rows[0].status === "unavailable") return blocked("unavailable");

  const active = await db.query<{ id: number }>(
    "SELECT id FROM queue_entries WHERE barber_id=$1 AND status='in_progress' LIMIT 1", [barberId]);
  if (active.rows[0]) return blocked("serving_customer", Number(active.rows[0].id));

  // A start transaction holds these locks until commit, serializing hours edits.
  await db.query("SELECT day_of_week FROM shop_operating_hours WHERE branch_id=$1 ORDER BY day_of_week FOR SHARE", [barber.rows[0].branch_id]);

  const clock = await db.query<{ instant: Date; local_time: string; weekday: number }>(
    `WITH clock AS (SELECT clock_timestamp() AS instant)
     SELECT instant, (instant AT TIME ZONE 'Asia/Manila')::time::text AS local_time,
       EXTRACT(DOW FROM instant AT TIME ZONE 'Asia/Manila')::integer AS weekday FROM clock`);
  const { instant, local_time: localTime, weekday } = clock.rows[0];
  const duration = visit?.durationMinutes ?? 0;
  const end = new Date(instant.getTime() + duration * 60_000);
  const interval = { startsAt: instant.toISOString(), endsAt: end.toISOString() };
  const attendance = (await db.query<{ status: "present" | "late" | "absent"; clock_out: Date | null }>(
    `SELECT status,clock_out FROM barber_attendance WHERE barber_id=$1
     AND attendance_date=($2::timestamptz AT TIME ZONE 'Asia/Manila')::date`, [barberId, instant])).rows[0];
  const attendanceDenied = attendance?.status === "absent" ? "absent" : attendance?.clock_out ? "clocked_out" : null;
  if (attendanceDenied) return { ...blocked(attendanceDenied), interval, attendanceState: attendanceDenied };
  // A PoolClient runs one query at a time; keep transaction reads sequential.
  const hours = await listShopHours(db, barber.rows[0].branch_id);
  const schedules = await listBarberSchedules(db, barberId);
  const absences = await listBarberUnavailability(db, barberId, instant.toISOString(), new Date(Math.max(end.getTime(), instant.getTime() + 1)).toISOString());
  const availability = evaluateAvailability({ status: barber.rows[0].status, activeQueueEntryId: null,
    instant: instant.toISOString(), localTime, weekday, attendance, hours, schedules, absences }, duration);
  if (!availability.available) return availability;
  const deny = (reason: OperationalReason) => ({ ...blocked(reason), interval });
  if (visit) {
    const minute = timeInMinutes;
    const startMinute = minute(localTime);
    const endMinute = startMinute + duration;
    const bookings = await db.query<{ booking_time: string; end_time: string | null; service_duration_minutes: number | null }>(
      `SELECT booking_time, end_time, service_duration_minutes FROM bookings
       WHERE barber_id=$1 AND booking_date=($2::timestamptz AT TIME ZONE 'Asia/Manila')::date
       AND status IN ('confirmed','checked_in','in_progress') AND ($3::bigint IS NULL OR id<>$3)`,
      [barberId, instant, visit.excludeBookingId ?? null]);
    if (bookings.rows.some((row) => {
      if (!row.end_time && !row.service_duration_minutes) return true;
      const start = minute(row.booking_time);
      const finish = row.end_time ? minute(row.end_time) : start + row.service_duration_minutes!;
      return startMinute < finish && endMinute > start;
    })) return deny("reservation_collision");
  }
  return availability;
}

type AvailabilitySnapshot = {
  status: "available" | "busy" | "unavailable";
  activeQueueEntryId: number | null;
  instant: string;
  localTime: string;
  weekday: number;
  attendance: { status: "present" | "late" | "absent"; clock_out: Date | string | null } | null | undefined;
  hours: ShopHours[];
  schedules: WeeklySchedule[];
  absences: OperationalInterval[];
};
const timeInMinutes = (time: string) => {
  const [h, m, s = 0] = time.split(":").map(Number);
  return h * 60 + m + s / 60;
};
function evaluateAvailability(snapshot: AvailabilitySnapshot, duration = 0): OperationalAvailability {
  const { status, activeQueueEntryId, localTime, weekday, attendance, hours, schedules, absences } = snapshot;
  if (status === "unavailable") return blocked("unavailable");
  if (activeQueueEntryId !== null) return blocked("serving_customer", Number(activeQueueEntryId));
  const instant = new Date(snapshot.instant);
  const end = new Date(instant.getTime() + duration * 60_000);
  const interval = { startsAt: instant.toISOString(), endsAt: end.toISOString() };
  const deny = (reason: OperationalReason) => ({ ...blocked(reason), interval });
  if (attendance?.status === "absent") return { ...deny("absent"), attendanceState: "absent" };
  if (attendance?.clock_out) return { ...deny("clocked_out"), attendanceState: "clocked_out" };
  const minute = timeInMinutes;
  const startMinute = minute(localTime);
  const endMinute = startMinute + duration;
  const shop = hours.find((day) => day.dayOfWeek === weekday);
  const shift = schedules.find((day) => day.dayOfWeek === weekday);
  if (!shop || shop.isClosed || !shift?.isWorking || localTime < shop.openTime || localTime >= shop.closeTime ||
      localTime < shift.startTime || localTime >= shift.endTime ||
      endMinute > Math.min(minute(shop.closeTime), minute(shift.endTime))) return deny("off_shift");
  if (shift.breaks.some((item) => startMinute < minute(item.endTime) && (duration ? endMinute > minute(item.startTime) : startMinute >= minute(item.startTime)))) return deny("break");
  if (absences.some((item) => Date.parse(item.startsAt) < Math.max(end.getTime(), instant.getTime() + 1) && Date.parse(item.endsAt) > instant.getTime()))
    return deny("temporary_unavailability");
  return { ...allowed, interval, attendanceState: attendance?.status ?? "unmarked" };
}

// Display reads use one database round trip and one authoritative clock for the
// whole list. Start transactions still use the locked single-barber guard above.
export async function listBarberOperationalAvailability(db: Db, barberIds: number[]): Promise<Map<number, OperationalAvailability>> {
  if (!barberIds.length) return new Map();
  const result = await db.query<AvailabilitySnapshot & { id: number }>(`
    WITH clock AS MATERIALIZED (SELECT clock_timestamp() AS instant)
    SELECT b.id, b.status, clock.instant::text AS instant,
      (clock.instant AT TIME ZONE 'Asia/Manila')::time::text AS "localTime",
      EXTRACT(DOW FROM clock.instant AT TIME ZONE 'Asia/Manila')::integer AS weekday,
      (SELECT q.id FROM queue_entries q WHERE q.barber_id=b.id AND q.status='in_progress' LIMIT 1) AS "activeQueueEntryId",
      (SELECT jsonb_build_object('status',a.status,'clock_out',a.clock_out) FROM barber_attendance a
        WHERE a.barber_id=b.id AND a.attendance_date=(clock.instant AT TIME ZONE 'Asia/Manila')::date) AS attendance,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('dayOfWeek',h.day_of_week,'openTime',left(h.open_time::text,5),
        'closeTime',left(h.close_time::text,5),'isClosed',h.is_closed)) FROM shop_operating_hours h WHERE h.branch_id=b.branch_id),'[]'::jsonb) AS hours,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('dayOfWeek',s.day_of_week,'isWorking',s.is_working,
        'startTime',left(s.start_time::text,5),'endTime',left(s.end_time::text,5),
        'breaks',COALESCE((SELECT jsonb_agg(jsonb_build_object('startTime',left(br.start_time::text,5),
          'endTime',left(br.end_time::text,5))) FROM barber_schedule_breaks br WHERE br.barber_schedule_id=s.id),'[]'::jsonb)))
        FROM barber_schedules s WHERE s.barber_id=b.id),'[]'::jsonb) AS schedules,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('startsAt',u.starts_at,'endsAt',u.ends_at))
        FROM barber_unavailability u WHERE u.barber_id=b.id AND u.ends_at>clock.instant
        AND u.starts_at<clock.instant + interval '1 millisecond'),'[]'::jsonb) AS absences
    FROM barbers b CROSS JOIN clock WHERE b.id=ANY($1::integer[])`, [barberIds]);
  return new Map(result.rows.map((snapshot) => {
    // Match the single-barber guard's early returns before checking configuration.
    if (snapshot.status !== "unavailable" && snapshot.activeQueueEntryId === null &&
        snapshot.attendance?.status !== "absent" && !snapshot.attendance?.clock_out &&
        new Set(snapshot.hours.map((day) => day.dayOfWeek)).size !== snapshot.hours.length) {
      throw new ShopHoursConfigurationError();
    }
    return [snapshot.id, evaluateAvailability(snapshot)];
  }));
}

export function requireBarberOperationalAvailability(result: OperationalAvailability): void {
  if (result.available) return;
  const messages: Record<OperationalReason, string> = {
    barber_not_found: "Barber not found.", unavailable: "Barber is unavailable.",
    absent: "Barber is marked absent today.",
    clocked_out: "Barber has clocked out today.",
    invalid_branch: "Barber and visit must belong to the same branch.",
    duration_unknown: "Visit duration is unresolved. Ask management to review this visit.",
    reservation_collision: "The full service would overlap another appointment.",
    serving_customer: "Barber is currently serving another customer.",
    off_shift: "Barber is not scheduled to work at this time.",
    break: "Barber is currently on a scheduled break.",
    temporary_unavailability: "Barber is temporarily unavailable.",
  };
  throw new BarberOperationalAvailabilityError(messages[result.reason!], result.reason!, result.interval);
}

export class BarberOperationalAvailabilityError extends Error {
  constructor(message: string, public reason?: OperationalReason, public interval?: OperationalInterval) { super(message); }
}
