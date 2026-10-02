-- Preserve legacy labels and records. An unambiguous existing name/code identifies
-- ownership; otherwise Main Branch is the agreed fallback, never current users.
-- Branch names support 160 characters; widen text snapshots without rewriting them.
ALTER TABLE inventory_items ALTER COLUMN branch TYPE VARCHAR(160);
ALTER TABLE inventory_movements ALTER COLUMN branch TYPE VARCHAR(160);
ALTER TABLE restock_requests ALTER COLUMN branch TYPE VARCHAR(160);
ALTER TABLE inventory_threshold_history ALTER COLUMN branch TYPE VARCHAR(160);
ALTER TABLE inventory_alert_acknowledgements ALTER COLUMN branch TYPE VARCHAR(160);
ALTER TABLE inventory_items ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE inventory_movements ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE restock_requests ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
DO $$
DECLARE target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY['inventory_items','inventory_movements','restock_requests'] LOOP
    EXECUTE format('UPDATE %I r SET branch_id=COALESCE((SELECT min(b.id) FROM branches b WHERE lower(btrim(r.branch)) IN (lower(b.name),lower(b.code)) HAVING count(*)=1),(SELECT id FROM branches WHERE code=''MAIN''))',target);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN branch_id SET NOT NULL',target);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN branch_id SET DEFAULT %s',target,(SELECT id FROM branches WHERE code='MAIN'));
  END LOOP;
END $$;
DROP INDEX inventory_items_sku_unique;
CREATE UNIQUE INDEX inventory_items_sku_unique ON inventory_items(branch_id,LOWER(sku))
  WHERE sku IS NOT NULL AND length(btrim(sku))>0;
CREATE INDEX inventory_items_branch_stock_idx ON inventory_items(branch_id,status,quantity);
CREATE INDEX inventory_movements_branch_created_idx ON inventory_movements(branch_id,created_at DESC);
CREATE INDEX restock_requests_branch_status_idx ON restock_requests(branch_id,status,created_at DESC);

-- Stock is one row per branch/product. No moves/transfers: immutable ownership
-- lets thresholds and alert acknowledgements inherit their item's branch safely.
CREATE FUNCTION preserve_inventory_branch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.branch IS DISTINCT FROM OLD.branch THEN
    RAISE EXCEPTION 'Inventory branch ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_branch_immutable BEFORE UPDATE OF branch_id,branch ON inventory_items
FOR EACH ROW EXECUTE FUNCTION preserve_inventory_branch();
CREATE TRIGGER restock_branch_immutable BEFORE UPDATE OF branch_id,branch ON restock_requests
FOR EACH ROW EXECUTE FUNCTION preserve_inventory_branch();

CREATE FUNCTION inventory_branch_label() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT name INTO NEW.branch FROM branches WHERE id=NEW.branch_id;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_creation_branch BEFORE INSERT ON inventory_items
FOR EACH ROW EXECUTE FUNCTION inventory_branch_label();
CREATE TRIGGER restock_creation_branch BEFORE INSERT ON restock_requests
FOR EACH ROW EXECUTE FUNCTION inventory_branch_label();

-- New movement snapshots must match the locked stock row. Historical snapshots
-- are independently backfilled from their own labels, never rewritten on edits.
ALTER TABLE inventory_movements ALTER COLUMN branch_id DROP DEFAULT;
CREATE FUNCTION snapshot_inventory_movement_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner INTEGER; label TEXT;
BEGIN
  SELECT branch_id,branch INTO owner,label FROM inventory_items WHERE id=NEW.inventory_item_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found' USING ERRCODE='23503'; END IF;
  IF NEW.branch_id IS NOT NULL AND NEW.branch_id<>owner THEN
    RAISE EXCEPTION 'Movement must belong to the inventory branch' USING ERRCODE='23514';
  END IF;
  NEW.branch_id:=owner; NEW.branch:=label;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_movement_branch_snapshot BEFORE INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION snapshot_inventory_movement_branch();
CREATE FUNCTION preserve_inventory_movement_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.branch IS DISTINCT FROM OLD.branch
     OR NEW.inventory_item_id IS DISTINCT FROM OLD.inventory_item_id THEN
    RAISE EXCEPTION 'Movement ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_movement_owner_immutable BEFORE UPDATE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION preserve_inventory_movement_owner();

-- Restock lines inherit immutable header ownership; no redundant branch column.
-- Existing lines remain intact, even where old free-text ownership disagreed.
CREATE FUNCTION validate_restock_item_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner INTEGER; item_owner INTEGER;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.restock_request_id<>OLD.restock_request_id OR NEW.inventory_item_id<>OLD.inventory_item_id) THEN
    RAISE EXCEPTION 'Restock line ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT branch_id INTO owner FROM restock_requests WHERE id=NEW.restock_request_id FOR SHARE;
  SELECT branch_id INTO item_owner FROM inventory_items WHERE id=NEW.inventory_item_id FOR SHARE;
  IF owner IS DISTINCT FROM item_owner THEN
    RAISE EXCEPTION 'Restock item must belong to the request branch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restock_item_branch_match BEFORE INSERT OR UPDATE OF restock_request_id,inventory_item_id ON restock_request_items
FOR EACH ROW EXECUTE FUNCTION validate_restock_item_branch();
