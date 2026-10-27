-- Preserve rows and constraints; correct only the dated interval in the existing
-- barber serialization trigger. Match migration 011, including unknown durations.
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
  IF NEW.status IN ('confirmed','checked_in','in_progress') AND EXISTS (
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
