CREATE TABLE barber_attendance (
  id BIGSERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'late', 'absent')),
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT barber_attendance_one_per_day UNIQUE (barber_id, attendance_date),
  CONSTRAINT barber_attendance_clock_order CHECK (clock_out IS NULL OR (clock_in IS NOT NULL AND clock_out >= clock_in)),
  CONSTRAINT barber_attendance_absent_clock CHECK (status <> 'absent' OR (clock_in IS NULL AND clock_out IS NULL))
);

CREATE INDEX barber_attendance_date_idx ON barber_attendance(attendance_date DESC, barber_id);

CREATE TABLE barber_attendance_corrections (
  id BIGSERIAL PRIMARY KEY,
  attendance_id BIGINT NOT NULL REFERENCES barber_attendance(id) ON DELETE RESTRICT,
  previous_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  corrected_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX barber_attendance_corrections_record_idx ON barber_attendance_corrections(attendance_id, id DESC);

CREATE FUNCTION prevent_attendance_correction_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Attendance corrections are append-only';
END;
$$;

CREATE TRIGGER barber_attendance_corrections_immutable
  BEFORE UPDATE OR DELETE ON barber_attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION prevent_attendance_correction_change();
