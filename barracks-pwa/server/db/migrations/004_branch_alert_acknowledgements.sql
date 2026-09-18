-- Sprint 1/Sprint 2 completion: preserve branch context in audit records and
-- persist per-user low-stock acknowledgement cycles.

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS branch VARCHAR(120) NOT NULL DEFAULT 'Main Branch';

-- Movements created before branch support existed belong to the branch carried
-- by their inventory item. Future movements keep a point-in-time branch value
-- so editing an item's branch does not rewrite historical audit context.
UPDATE inventory_movements m
SET branch = i.branch
FROM inventory_items i
WHERE i.id = m.inventory_item_id;

CREATE INDEX IF NOT EXISTS inventory_movements_branch_idx
  ON inventory_movements (branch, created_at DESC);

ALTER TABLE inventory_threshold_history
  ADD COLUMN IF NOT EXISTS branch VARCHAR(120) NOT NULL DEFAULT 'Main Branch';

UPDATE inventory_threshold_history h
SET branch = i.branch
FROM inventory_items i
WHERE i.id = h.inventory_item_id;

CREATE INDEX IF NOT EXISTS inventory_threshold_history_branch_idx
  ON inventory_threshold_history (branch, changed_at DESC);

CREATE TABLE IF NOT EXISTS inventory_alert_acknowledgements (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
  branch VARCHAR(120) NOT NULL,
  acknowledged_by INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  acknowledged_quantity INTEGER NOT NULL CHECK (acknowledged_quantity >= 0),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (inventory_item_id, acknowledged_by)
);

CREATE INDEX IF NOT EXISTS inventory_alert_ack_item_user_idx
  ON inventory_alert_acknowledgements (inventory_item_id, acknowledged_by);
CREATE INDEX IF NOT EXISTS inventory_alert_ack_active_idx
  ON inventory_alert_acknowledgements (acknowledged_by, resolved_at);
