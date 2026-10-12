// Match migration 011's exclusion ranges. A TIME end can wrap at midnight;
// only the immutable duration establishes the dated interval. Unknown legacy
// durations conservatively occupy their booking day.
export const bookingIntervalStartSql = `CASE WHEN service_duration_minutes IS NULL
  THEN booking_date::timestamp ELSE booking_date + booking_time END`;
export const bookingIntervalEndSql = `CASE WHEN service_duration_minutes IS NULL
  THEN booking_date::timestamp + INTERVAL '1 day'
  ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END`;
