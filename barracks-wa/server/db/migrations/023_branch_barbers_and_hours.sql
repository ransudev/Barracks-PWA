-- Phase 2: barber ownership and branch hours only. Existing schedules stay intact.
ALTER TABLE barbers ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
UPDATE barbers SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
ALTER TABLE barbers ALTER COLUMN branch_id SET NOT NULL;
-- Legacy SQL import/seed paths receive Main Branch; staff APIs require an explicit branch.
DO $$ DECLARE main_id INTEGER; BEGIN
  SELECT id INTO STRICT main_id FROM branches WHERE code='MAIN';
  EXECUTE format('ALTER TABLE barbers ALTER COLUMN branch_id SET DEFAULT %s', main_id);
END $$;
CREATE INDEX barbers_branch_idx ON barbers(branch_id);

ALTER TABLE shop_operating_hours ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;
UPDATE shop_operating_hours SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
ALTER TABLE shop_operating_hours ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE shop_operating_hours DROP CONSTRAINT shop_operating_hours_day_of_week_key;
ALTER TABLE shop_operating_hours ADD CONSTRAINT shop_hours_branch_day_key UNIQUE(branch_id,day_of_week);
INSERT INTO shop_operating_hours(branch_id,day_of_week,open_time,close_time)
SELECT b.id,day,'09:00','19:30' FROM branches b CROSS JOIN generate_series(0,6) AS day
WHERE b.code<>'MAIN';
CREATE FUNCTION initialize_branch_hours() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO shop_operating_hours(branch_id,day_of_week,open_time,close_time)
  SELECT NEW.id,day,'09:00','19:30' FROM generate_series(0,6) AS day;
  RETURN NEW;
END $$;
CREATE TRIGGER branches_default_hours AFTER INSERT ON branches
FOR EACH ROW EXECUTE FUNCTION initialize_branch_hours();

-- Moves preserve shifts, breaks and absences. Refuse conflicting destination
-- hours or committed operational work; no booking/queue branch columns are added.
CREATE FUNCTION validate_barber_branch_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.branch_id=OLD.branch_id THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM bookings WHERE barber_id=OLD.id AND status IN ('confirmed','checked_in','in_progress'))
    OR EXISTS(SELECT 1 FROM queue_entries WHERE barber_id=OLD.id AND status IN ('waiting','ready','in_progress')) THEN
    RAISE EXCEPTION 'Resolve active bookings and queue entries before moving this barber' USING ERRCODE='23514';
  END IF;
  IF (SELECT count(*) FROM shop_operating_hours WHERE branch_id=NEW.branch_id)<>7
    OR EXISTS(SELECT 1 FROM barber_schedules s LEFT JOIN shop_operating_hours h
      ON h.branch_id=NEW.branch_id AND h.day_of_week=s.day_of_week
      WHERE s.barber_id=OLD.id AND s.is_working AND
        (h.id IS NULL OR h.is_closed OR s.start_time<h.open_time OR s.end_time>h.close_time)) THEN
    RAISE EXCEPTION 'Barber schedule must fit destination branch hours before moving' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER barbers_safe_branch_move BEFORE UPDATE OF branch_id ON barbers
FOR EACH ROW EXECUTE FUNCTION validate_barber_branch_move();
