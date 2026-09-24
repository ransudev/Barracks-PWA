CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A legacy booking without a known duration conservatively occupies its day.
-- Exclusion constraints are the final authority when concurrent writers race.
ALTER TABLE bookings ADD CONSTRAINT bookings_active_barber_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tsrange(
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
           ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
      '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'checked_in', 'in_progress'));

ALTER TABLE bookings ADD CONSTRAINT bookings_active_customer_overlap
  EXCLUDE USING gist (
    customer_id WITH =,
    tsrange(
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
           ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
      '[)') WITH &&
  ) WHERE (status IN ('confirmed', 'checked_in', 'in_progress'));
