export const BOOKING_GRACE_MINUTES = 10;

export function mayMarkNoShow(date: string, time: string, now = new Date()): boolean {
  return now.getTime() >= Date.parse(`${date}T${time}:00+08:00`) + BOOKING_GRACE_MINUTES * 60_000;
}
