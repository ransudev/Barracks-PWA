-- Phase 3: preserve every record and snapshot; legacy ownership is Main Branch.
ALTER TABLE bookings ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE queue_entries ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
UPDATE bookings SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
UPDATE queue_entries SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
ALTER TABLE bookings ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE queue_entries ALTER COLUMN branch_id SET NOT NULL;
DO $$ DECLARE main_id INTEGER; BEGIN
  SELECT id INTO STRICT main_id FROM branches WHERE code='MAIN';
  EXECUTE format('ALTER TABLE bookings ALTER COLUMN branch_id SET DEFAULT %s',main_id);
  EXECUTE format('ALTER TABLE queue_entries ALTER COLUMN branch_id SET DEFAULT %s',main_id);
END $$;
CREATE INDEX bookings_branch_date_idx ON bookings(branch_id,booking_date,booking_time);
CREATE INDEX queue_entries_branch_status_joined_idx ON queue_entries(branch_id,status,joined_at,id);

-- Row locks serialize assignment with Phase 2 barber moves. Historical barber
-- references may differ after a move; only new/changed assignments are checked.
CREATE FUNCTION validate_visit_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner INTEGER;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
      RAISE EXCEPTION 'Visit branch ownership cannot be changed' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.barber_id IS DISTINCT FROM OLD.barber_id THEN
    IF NEW.barber_id IS NOT NULL THEN
      SELECT branch_id INTO owner FROM barbers WHERE id=NEW.barber_id FOR SHARE;
      IF owner IS DISTINCT FROM NEW.branch_id THEN
        RAISE EXCEPTION 'Barber must belong to the visit branch' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME='queue_entries' THEN
    IF NEW.booking_id IS NOT NULL THEN
    SELECT branch_id INTO owner FROM bookings WHERE id=NEW.booking_id FOR SHARE;
    IF owner IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'Appointment queue branch must match booking branch' USING ERRCODE='23514';
    END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_branch_integrity BEFORE INSERT OR UPDATE OF branch_id,barber_id ON bookings
FOR EACH ROW EXECUTE FUNCTION validate_visit_branch();
CREATE TRIGGER queue_branch_integrity BEFORE INSERT OR UPDATE OF branch_id,barber_id,booking_id ON queue_entries
FOR EACH ROW EXECUTE FUNCTION validate_visit_branch();
