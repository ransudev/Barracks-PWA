-- Customer self-bookings now wait for staff approval. A pending request holds
-- its slot exactly like a confirmed appointment so two customers cannot request
-- the same barber time while staff review. Rejected requests release the slot.
ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'));

DROP INDEX bookings_active_barber_slot_unique;
CREATE UNIQUE INDEX bookings_active_barber_slot_unique
  ON bookings (barber_id, booking_date, booking_time)
  WHERE status IN ('pending', 'confirmed', 'checked_in', 'in_progress');

ALTER TABLE bookings DROP CONSTRAINT bookings_active_barber_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_active_barber_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tsrange(
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
           ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
      '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'checked_in', 'in_progress'));

ALTER TABLE bookings DROP CONSTRAINT bookings_active_customer_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_active_customer_overlap
  EXCLUDE USING gist (
    customer_id WITH =,
    tsrange(
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
           ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
      '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'checked_in', 'in_progress'));

CREATE OR REPLACE FUNCTION lock_booking_barbers() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM id FROM barbers WHERE id=NEW.barber_id FOR UPDATE;
  ELSIF TG_OP='DELETE' THEN
    PERFORM id FROM barbers WHERE id=OLD.barber_id FOR UPDATE;
    RETURN OLD;
  ELSE
    PERFORM id FROM barbers WHERE id IN (OLD.barber_id,NEW.barber_id) ORDER BY id FOR UPDATE;
  END IF;
  IF NEW.status IN ('pending','confirmed','checked_in','in_progress') AND EXISTS (
    SELECT 1 FROM queue_entries q WHERE q.barber_id=NEW.barber_id AND q.status='in_progress'
      AND q.booking_id IS DISTINCT FROM NEW.id
      AND (q.service_duration_minutes_snapshot IS NULL OR
        ((CASE WHEN NEW.service_duration_minutes IS NULL THEN NEW.booking_date::timestamp
          ELSE NEW.booking_date + NEW.booking_time END) AT TIME ZONE 'Asia/Manila') <
          q.started_at + q.service_duration_minutes_snapshot * INTERVAL '1 minute'
        AND ((CASE WHEN NEW.service_duration_minutes IS NULL THEN NEW.booking_date::timestamp + INTERVAL '1 day'
          ELSE NEW.booking_date + NEW.booking_time + NEW.service_duration_minutes * INTERVAL '1 minute' END)
          AT TIME ZONE 'Asia/Manila') > q.started_at)
  ) THEN
    RAISE EXCEPTION 'Appointment overlaps an active service'
      USING ERRCODE='23P01', CONSTRAINT='bookings_active_barber_overlap';
  END IF;
  RETURN NEW;
END;
$$;
