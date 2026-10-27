-- Legacy records have no branch-at-creation or barber-move history. The agreed
-- fallback is Main Branch; current barber ownership must not rewrite the past.
ALTER TABLE barber_attendance ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
UPDATE barber_attendance SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
ALTER TABLE barber_attendance ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX barber_attendance_branch_date_idx ON barber_attendance(branch_id,attendance_date DESC,barber_id);

-- Snapshot ownership only on creation. No composite FK to current barber branch:
-- moving a barber must leave previous attendance and corrections intact.
CREATE FUNCTION snapshot_attendance_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner INTEGER;
BEGIN
  SELECT branch_id INTO owner FROM barbers WHERE id=NEW.barber_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance barber not found' USING ERRCODE='23503';
  END IF;
  IF NEW.branch_id IS NOT NULL AND NEW.branch_id<>owner THEN
    RAISE EXCEPTION 'New attendance branch must match barber branch'
      USING ERRCODE='23514', CONSTRAINT='attendance_creation_branch_match';
  END IF;
  NEW.branch_id := owner;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_branch_snapshot BEFORE INSERT ON barber_attendance
FOR EACH ROW EXECUTE FUNCTION snapshot_attendance_branch();

CREATE FUNCTION preserve_attendance_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.barber_id IS DISTINCT FROM OLD.barber_id THEN
    RAISE EXCEPTION 'Attendance branch and barber ownership cannot be changed'
      USING ERRCODE='23514', CONSTRAINT='attendance_ownership_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_ownership_immutable BEFORE UPDATE OF branch_id,barber_id ON barber_attendance
FOR EACH ROW EXECUTE FUNCTION preserve_attendance_ownership();
