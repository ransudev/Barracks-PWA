-- Sprint 2 acceptance-criteria alignment: inventory operations, branch tracking,
-- threshold audit history, and duplicate supplier protection.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS branch VARCHAR(120) NOT NULL DEFAULT 'Main Branch';

ALTER TABLE restock_requests
  ADD COLUMN IF NOT EXISTS branch VARCHAR(120) NOT NULL DEFAULT 'Main Branch';

CREATE INDEX IF NOT EXISTS inventory_items_branch_idx ON inventory_items (branch);
CREATE INDEX IF NOT EXISTS restock_requests_branch_idx ON restock_requests (branch, created_at DESC);

-- Expand movement types without losing existing Sprint 2 movement history.
ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type IN (
    'RECEIVE',
    'USE',
    'CUSTOMER_PURCHASE',
    'STAFF_USAGE',
    'DAMAGE',
    'DISCARD',
    'RETURN',
    'ADJUSTMENT'
  ));

-- Keep stock-threshold changes auditable by item, user, and timestamp.
CREATE TABLE IF NOT EXISTS inventory_threshold_history (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items (id) ON DELETE RESTRICT,
  previous_minimum_stock INTEGER NOT NULL CHECK (previous_minimum_stock >= 0),
  new_minimum_stock INTEGER NOT NULL CHECK (new_minimum_stock >= 0),
  previous_maximum_stock INTEGER,
  new_maximum_stock INTEGER,
  changed_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (previous_maximum_stock IS NULL OR previous_maximum_stock >= previous_minimum_stock),
  CHECK (new_maximum_stock IS NULL OR new_maximum_stock >= new_minimum_stock)
);

CREATE INDEX IF NOT EXISTS inventory_threshold_history_item_idx
  ON inventory_threshold_history (inventory_item_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS inventory_threshold_history_user_idx
  ON inventory_threshold_history (changed_by, changed_at DESC);

-- Active supplier names must be unique, case-insensitively. Inactive historical
-- records may keep the same name so a supplier can later be re-created cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_active_company_name_unique
  ON suppliers (LOWER(BTRIM(company_name)))
  WHERE status = 'active';
