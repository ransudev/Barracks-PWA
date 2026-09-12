-- Sprint 2: relational supplier, inventory, restock, receiving, service and transaction foundation.

INSERT INTO roles (name, description)
VALUES ('supplier', 'Can access only the supplier portal and records linked to their supplier profile.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(180) NOT NULL,
  contact_person VARCHAR(180) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(320) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suppliers_company_name_not_blank CHECK (length(btrim(company_name)) > 0)
);

CREATE INDEX IF NOT EXISTS suppliers_status_idx ON suppliers (status);
CREATE INDEX IF NOT EXISTS suppliers_company_name_idx ON suppliers (LOWER(company_name));

CREATE TABLE IF NOT EXISTS supplier_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL UNIQUE REFERENCES suppliers (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS supplier_accounts_supplier_id_idx ON supplier_accounts (supplier_id);

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers (id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit VARCHAR(40) NOT NULL DEFAULT 'unit';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS maximum_stock INTEGER;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_maximum_stock_check') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_maximum_stock_check
      CHECK (maximum_stock IS NULL OR maximum_stock >= minimum_stock);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_status_check') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_sku_unique
  ON inventory_items (LOWER(sku)) WHERE sku IS NOT NULL AND length(btrim(sku)) > 0;
CREATE INDEX IF NOT EXISTS inventory_items_supplier_id_idx ON inventory_items (supplier_id);
CREATE INDEX IF NOT EXISTS inventory_items_stock_idx ON inventory_items (quantity, minimum_stock);
CREATE INDEX IF NOT EXISTS inventory_items_status_idx ON inventory_items (status);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items (id) ON DELETE RESTRICT,
  supplier_id INTEGER REFERENCES suppliers (id) ON DELETE SET NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('RECEIVE', 'USE', 'DAMAGE', 'RETURN', 'ADJUSTMENT')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  previous_stock INTEGER NOT NULL CHECK (previous_stock >= 0),
  new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
  unit_cost NUMERIC(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reference VARCHAR(160),
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inventory_movements_item_created_idx ON inventory_movements (inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_supplier_idx ON inventory_movements (supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_created_by_idx ON inventory_movements (created_by);

CREATE TABLE IF NOT EXISTS restock_requests (
  id BIGSERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Preparing', 'Shipped', 'Delivered', 'Received', 'Cancelled')),
  reference VARCHAR(160),
  notes TEXT NOT NULL DEFAULT '',
  requested_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  received_by INTEGER REFERENCES users (id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS restock_requests_supplier_status_idx ON restock_requests (supplier_id, status);
CREATE INDEX IF NOT EXISTS restock_requests_requested_by_idx ON restock_requests (requested_by);
CREATE INDEX IF NOT EXISTS restock_requests_received_by_idx ON restock_requests (received_by);

CREATE TABLE IF NOT EXISTS restock_request_items (
  id BIGSERIAL PRIMARY KEY,
  restock_request_id BIGINT NOT NULL REFERENCES restock_requests (id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items (id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  delivered_quantity INTEGER CHECK (delivered_quantity IS NULL OR delivered_quantity >= 0),
  unit_cost NUMERIC(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restock_request_id, inventory_item_id)
);
CREATE INDEX IF NOT EXISTS restock_request_items_inventory_idx ON restock_request_items (inventory_item_id);

CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  current_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO services (id, name, current_price)
SELECT DISTINCT service_id, service_name, service_price
FROM bookings
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_service_id_fkey') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS bookings_barber_id_idx ON bookings (barber_id);
CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON bookings (service_id);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  booking_id BIGINT REFERENCES bookings (id) ON DELETE SET NULL,
  barber_id INTEGER REFERENCES barbers (id) ON DELETE SET NULL,
  service_id VARCHAR(80) REFERENCES services (id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_customer_idx ON transactions (customer_id);
CREATE INDEX IF NOT EXISTS transactions_booking_idx ON transactions (booking_id);
CREATE INDEX IF NOT EXISTS transactions_barber_idx ON transactions (barber_id);
CREATE INDEX IF NOT EXISTS transactions_service_idx ON transactions (service_id);
