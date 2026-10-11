-- Existing walk-ins have no historical duration evidence. Leave them unresolved
-- rather than inventing a duration from today's catalog; new starts fail closed.
ALTER TABLE queue_entries ADD COLUMN service_duration_minutes_snapshot INTEGER
  CHECK (service_duration_minutes_snapshot > 0);
UPDATE queue_entries q SET service_duration_minutes_snapshot=b.service_duration_minutes
FROM bookings b WHERE b.id=q.booking_id;

CREATE FUNCTION set_queue_duration_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT service_duration_minutes INTO NEW.service_duration_minutes_snapshot
    FROM bookings WHERE id=NEW.booking_id;
  ELSE
    SELECT duration_minutes INTO NEW.service_duration_minutes_snapshot
    FROM services WHERE id=NEW.service_id;
    IF NEW.service_duration_minutes_snapshot IS NULL THEN
      RAISE EXCEPTION 'Service duration is required for a new walk-in' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER queue_entries_duration_before_insert BEFORE INSERT ON queue_entries
FOR EACH ROW EXECUTE FUNCTION set_queue_duration_snapshot();

CREATE FUNCTION prevent_queue_duration_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.service_duration_minutes_snapshot IS DISTINCT FROM OLD.service_duration_minutes_snapshot THEN
    RAISE EXCEPTION 'Visit duration snapshot cannot be changed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER queue_entries_duration_before_update
BEFORE UPDATE OF service_duration_minutes_snapshot ON queue_entries
FOR EACH ROW EXECUTE FUNCTION prevent_queue_duration_change();

-- Reservation edits and new service starts serialize on the barber row. This
-- closes the window between an interval check and a concurrent reservation.
CREATE FUNCTION lock_booking_barbers() RETURNS trigger LANGUAGE plpgsql AS $$
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
        ((NEW.booking_date + NEW.booking_time) AT TIME ZONE 'Asia/Manila') <
          q.started_at + q.service_duration_minutes_snapshot * INTERVAL '1 minute'
        AND ((NEW.booking_date + COALESCE(NEW.end_time,'23:59:59'::time)) AT TIME ZONE 'Asia/Manila') > q.started_at)
  ) THEN
    RAISE EXCEPTION 'Appointment overlaps an active service'
      USING ERRCODE='23P01', CONSTRAINT='bookings_active_barber_overlap';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bookings_barber_serialization BEFORE INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION lock_booking_barbers();
