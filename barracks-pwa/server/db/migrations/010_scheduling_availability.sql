-- Weekdays use JavaScript's 0=Sunday through 6=Saturday convention.
CREATE TABLE shop_operating_hours (
  id SERIAL PRIMARY KEY,
  day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (open_time < close_time)
);

INSERT INTO shop_operating_hours (day_of_week, open_time, close_time)
SELECT day, '09:00', '19:30' FROM generate_series(0, 6) AS day;

CREATE TABLE barber_schedules (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (barber_id, day_of_week),
  CHECK (start_time < end_time)
);

-- Preserve the currently published daily opening schedule for existing barbers.
INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time)
SELECT b.id, day, '09:00', '19:30' FROM barbers b CROSS JOIN generate_series(0, 6) AS day;

CREATE TABLE barber_schedule_breaks (
  id SERIAL PRIMARY KEY,
  barber_schedule_id INTEGER NOT NULL REFERENCES barber_schedules(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time)
);

CREATE TABLE barber_unavailability (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(200) NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_at < ends_at)
);
CREATE INDEX barber_unavailability_lookup_idx ON barber_unavailability (barber_id, starts_at, ends_at);
