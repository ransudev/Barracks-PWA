CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Report legacy conflicts before either constraint is created. The migration
-- runner rolls back this entire file on error and does not record it as applied.
DO $$
DECLARE
  conflicting_ids TEXT;
BEGIN
  WITH active AS (
    SELECT id, barber_id, customer_id,
      tsrange(
        CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
        CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
             ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
        '[)') AS appointment_range
    FROM bookings WHERE status IN ('confirmed', 'checked_in', 'in_progress')
  )
  SELECT string_agg(format('%s/%s', first_id, second_id), ', ' ORDER BY first_id, second_id)
  INTO conflicting_ids
  FROM (
    SELECT a.id AS first_id, b.id AS second_id FROM active a JOIN active b
      ON a.id < b.id AND a.barber_id = b.barber_id AND a.appointment_range && b.appointment_range
    ORDER BY a.id, b.id LIMIT 20
  ) conflicts;
  IF conflicting_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 011 blocked by overlapping active barber bookings (ID pairs): %', conflicting_ids
      USING HINT = 'Run scripts/booking-overlap-review.sql, reconcile the listed bookings, then rerun migrations.';
  END IF;

  WITH active AS (
    SELECT id, customer_id,
      tsrange(
        CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
        CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
             ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
        '[)') AS appointment_range
    FROM bookings WHERE status IN ('confirmed', 'checked_in', 'in_progress')
  )
  SELECT string_agg(format('%s/%s', first_id, second_id), ', ' ORDER BY first_id, second_id)
  INTO conflicting_ids
  FROM (
    SELECT a.id AS first_id, b.id AS second_id FROM active a JOIN active b
      ON a.id < b.id AND a.customer_id = b.customer_id AND a.appointment_range && b.appointment_range
    ORDER BY a.id, b.id LIMIT 20
  ) conflicts;
  IF conflicting_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 011 blocked by overlapping active customer bookings (ID pairs): %', conflicting_ids
      USING HINT = 'Run scripts/booking-overlap-review.sql, reconcile the listed bookings, then rerun migrations.';
  END IF;
END $$;

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
