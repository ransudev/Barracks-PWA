CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description)
VALUES
  ('administrator', 'Can manage user accounts and access management features.'),
  ('front_desk', 'Can manage customers, barbers, and inventory for shop operations.'),
  ('customer', 'Can view and update their own customer profile.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS users_role_id_idx
  ON users (role_id);

-- Existing prototype barber accounts are staff records now, not login identities.
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'front_desk')
WHERE role_id = (SELECT id FROM roles WHERE name = 'barber');

DELETE FROM roles WHERE name = 'barber';

CREATE TABLE IF NOT EXISTS barbers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'busy', 'unavailable')),
  commission_rate NUMERIC(5, 2),
  services_done INTEGER NOT NULL DEFAULT 0 CHECK (services_done >= 0),
  revenue NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE barbers DROP COLUMN IF EXISTS specialty;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS services_done INTEGER NOT NULL DEFAULT 0 CHECK (services_done >= 0);
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS revenue NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (revenue >= 0);
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5);

CREATE INDEX IF NOT EXISTS barbers_status_idx ON barbers (status);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  preferred_barber_id INTEGER REFERENCES barbers (id) ON DELETE SET NULL,
  loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_preferred_barber_idx
  ON customers (preferred_barber_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL
    CHECK (category IN ('Supplies', 'Equipment', 'Products')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_items_category_idx
  ON inventory_items (category);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers (id) ON DELETE RESTRICT,
  service_id VARCHAR(80) NOT NULL,
  service_name VARCHAR(160) NOT NULL,
  service_price NUMERIC(12, 2) NOT NULL CHECK (service_price >= 0),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  demo_key VARCHAR(80) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_customer_date_idx
  ON bookings (customer_id, booking_date DESC, booking_time DESC);

CREATE INDEX IF NOT EXISTS bookings_date_idx
  ON bookings (booking_date, booking_time);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_barber_slot_unique
  ON bookings (barber_id, booking_date, booking_time)
  WHERE status = 'upcoming';

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
  ON sessions (expires_at);
