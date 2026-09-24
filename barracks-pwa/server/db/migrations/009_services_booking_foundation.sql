ALTER TABLE services ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE services ADD COLUMN duration_minutes INTEGER;

UPDATE services SET
  description = CASE id
    WHEN 'barracks-basic' THEN 'A clean, tailored cut finished to your preference.'
    WHEN 'signature-shave' THEN 'A close shave with a warm towel finish.'
    WHEN 'barracks-premium' THEN 'A complete cut, styling, and premium finish.'
    ELSE description END,
  duration_minutes = CASE id
    WHEN 'barracks-basic' THEN 45
    WHEN 'signature-shave' THEN 30
    WHEN 'barracks-premium' THEN 75
    ELSE duration_minutes END;

-- Historical service IDs have no known duration. Keep their snapshots intact and
-- prevent them from being booked until a manager supplies a duration.
UPDATE services SET active = FALSE WHERE duration_minutes IS NULL;
ALTER TABLE services ADD CONSTRAINT services_duration_check
  CHECK (duration_minutes > 0 AND duration_minutes <= 2147483647);
ALTER TABLE services ADD CONSTRAINT services_active_duration_check
  CHECK (NOT active OR duration_minutes IS NOT NULL);

ALTER TABLE bookings ADD COLUMN service_duration_minutes INTEGER;
ALTER TABLE bookings ADD COLUMN end_time TIME;
ALTER TABLE bookings ADD COLUMN notes VARCHAR(500);
ALTER TABLE bookings ADD CONSTRAINT bookings_duration_check
  CHECK (service_duration_minutes IS NULL OR service_duration_minutes > 0);

-- Existing booking name and price are already snapshots; only fill fields that
-- can be derived from the known catalog without changing those snapshots.
UPDATE bookings b SET service_duration_minutes = s.duration_minutes,
  end_time = (b.booking_time + s.duration_minutes * INTERVAL '1 minute')::TIME
FROM services s WHERE b.service_id = s.id AND s.duration_minutes IS NOT NULL;

ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('upcoming', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'));
UPDATE bookings SET status = 'confirmed' WHERE status = 'upcoming';
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'confirmed';
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'));

DROP INDEX bookings_active_barber_slot_unique;
CREATE UNIQUE INDEX bookings_active_barber_slot_unique
  ON bookings (barber_id, booking_date, booking_time)
  WHERE status IN ('confirmed', 'checked_in', 'in_progress');
