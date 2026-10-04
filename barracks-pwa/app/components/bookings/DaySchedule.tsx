"use client";

import type { ApiBooking, ApiBarberAvailability } from "@/app/lib/api";
import type { ShopHours, WeeklySchedule, Unavailability } from "@/server/services/schedule.service";
import { Badge } from "@/app/components/ui";

export type DayContext = { date: string; barbers: { barberId: number; shift: WeeklySchedule | null; timeAway: Unavailability[] }[]; shopHours: ShopHours | null; hoursError: string };
const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const statusLabel = (value: string) => value.replaceAll("_", " ");
const endMinute = (booking: ApiBooking) => booking.durationMinutes && booking.durationMinutes > 0 ? minutes(booking.time) + booking.durationMinutes : booking.endTime && minutes(booking.endTime) > minutes(booking.time) ? minutes(booking.endTime) : null;

export function DaySchedule({ bookings, barbers, context, date, onOpen }: { bookings: ApiBooking[]; barbers: ApiBarberAvailability[]; context: DayContext | null; date: string; onOpen: (booking: ApiBooking) => void }) {
  const times = bookings.flatMap((booking) => [minutes(booking.time), endMinute(booking) ?? minutes(booking.time)]);
  const unknownDuration = bookings.filter((booking) => endMinute(booking) === null);
  const shifts = context?.barbers.flatMap(({ shift }) => shift?.isWorking ? [minutes(shift.startTime), minutes(shift.endTime)] : []) ?? [];
  const start = Math.max(0, Math.floor(Math.min(9 * 60, ...times, ...shifts) / 60) * 60);
  const end = Math.min(24 * 60, Math.ceil(Math.max(20 * 60, ...times, ...shifts) / 60) * 60);
  // Keep a 30-minute visit tall enough to scan all appointment facts.
  const scale = 4;
  const columns = [...barbers.map((barber) => ({ id: barber.id, name: `${barber.firstName} ${barber.lastName}` })),
    ...[...new Set(bookings.filter((booking) => !barbers.some((barber) => barber.id === booking.barberId)).map((booking) => booking.barberId))].map((id) => ({ id, name: bookings.find((booking) => booking.barberId === id)?.barberName || "Unassigned" }))];
  return <>
    <p className="task-note">Asia/Manila · Gaps are not bookable slots. New and edited bookings use validated availability.</p>
    {context?.hoursError && <p role="alert" className="form-error">{context.hoursError}</p>}
    {context?.shopHours && <p className="task-note">Shop: {context.shopHours.isClosed ? "Closed" : `${context.shopHours.openTime}–${context.shopHours.closeTime}`}</p>}
    {unknownDuration.length > 0 && <div className="duration-unavailable"><p>Appointments with unavailable duration</p>{unknownDuration.map((booking) => <button type="button" key={booking.id} onClick={() => onOpen(booking)}>{booking.time} · {booking.customerName} · {booking.serviceName} · {booking.barberName} · {statusLabel(booking.status)}</button>)}</div>}
    <div className="day-schedule" aria-label={`Appointments on ${date}`}>
      <div className="day-schedule__grid" style={{ gridTemplateColumns: `64px repeat(${Math.max(1, columns.length)}, minmax(200px, 1fr))` }}>
        <div className="day-schedule__corner">Time</div>{columns.map((column) => {
          const data = context?.barbers.find((barber) => barber.barberId === column.id);
          return <div className="day-schedule__heading" key={column.id}><strong>{column.name}</strong><small>{!data ? "Schedule unavailable" : !data.shift ? "Shift not configured" : data.shift.isWorking ? `${data.shift.startTime}–${data.shift.endTime}` : "Scheduled off"}</small></div>;
        })}
        <div className="day-schedule__axis" style={{ height: (end - start) * scale }}>{Array.from({ length: (end - start) / 60 }, (_, index) => <span key={index} style={{ top: index * 60 * scale }}>{clock(start + index * 60)}</span>)}</div>
        {columns.map((column) => {
          const data = context?.barbers.find((barber) => barber.barberId === column.id);
          const events = bookings.filter((booking) => booking.barberId === column.id && endMinute(booking) !== null).sort((a, b) => a.time.localeCompare(b.time));
          // A component of overlapping intervals shares a lane count, so none occludes another.
          const placed: { booking: ApiBooking; lane: number; lanes: number }[] = [];
          let group: typeof placed = []; let groupEnd = -1; let laneEnds: number[] = [];
          const flush = () => { group.forEach((entry) => { entry.lanes = laneEnds.length; }); placed.push(...group); group = []; laneEnds = []; };
          events.forEach((booking) => { const begin = minutes(booking.time); const finish = endMinute(booking)!; if (begin >= groupEnd) flush(); let lane = laneEnds.findIndex((value) => value <= begin); if (lane < 0) lane = laneEnds.length; laneEnds[lane] = finish; groupEnd = Math.max(...laneEnds); group.push({ booking, lane, lanes: 1 }); }); flush();
          const blockStyle = (begin: number, finish: number) => ({ top: (Math.max(start, begin) - start) * scale, height: Math.max(0, Math.min(end, finish) - Math.max(start, begin)) * scale });
          return <div className="day-schedule__column" key={column.id} style={{ height: (end - start) * scale }}>
            {Array.from({ length: (end - start) / 60 }, (_, index) => <div className="day-schedule__hour" key={index} style={{ top: index * 60 * scale }} />)}
            {data?.shift && !data.shift.isWorking && <div className="day-schedule__constraint" style={{ top: 0, height: "100%" }}>Scheduled off</div>}
            {data?.shift?.isWorking && <><div className="day-schedule__constraint" style={blockStyle(start, minutes(data.shift.startTime))}>Outside shift</div><div className="day-schedule__constraint" style={blockStyle(minutes(data.shift.endTime), end)}>Outside shift</div>{data.shift.breaks.map((pause, index) => <div className="day-schedule__constraint" key={index} style={blockStyle(minutes(pause.startTime), minutes(pause.endTime))}>Break {pause.startTime}–{pause.endTime}</div>)}</>}
            {data?.timeAway.map((away) => { const startInstant = Date.parse(`${date}T00:00:00+08:00`); return <div className="day-schedule__constraint day-schedule__constraint--away" key={away.id} style={blockStyle((Date.parse(away.startsAt) - startInstant) / 60000, (Date.parse(away.endsAt) - startInstant) / 60000)}>Time away · {away.reason}</div>; })}
            {placed.map(({ booking, lane, lanes }) => <button type="button" className="day-schedule__booking" key={booking.id} style={{ ...blockStyle(minutes(booking.time), endMinute(booking)!), left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }} onClick={() => onOpen(booking)} aria-label={`${booking.customerName}, ${booking.serviceName}, ${booking.time}, ${statusLabel(booking.status)}, ${column.name}`}><span>{booking.time}{endMinute(booking) ? `–${clock(endMinute(booking)!)}` : " · Duration unavailable"}</span><strong>{booking.customerName}</strong><small>{booking.serviceName}</small><Badge tone={booking.status === "completed" ? "success" : ["cancelled", "no_show"].includes(booking.status) ? "danger" : "info"}>{statusLabel(booking.status)}</Badge></button>)}
          </div>;
        })}
      </div>
    </div>
  </>;
}
