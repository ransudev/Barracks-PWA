-- Keep the charged name and amount attached to the visit. Appointment queue
-- entries copy the booking snapshot; walk-ins snapshot the service at enqueue.
ALTER TABLE queue_entries ADD COLUMN service_name_snapshot VARCHAR(160);
ALTER TABLE queue_entries ADD COLUMN service_price_snapshot NUMERIC(12,2);

UPDATE queue_entries q SET
  service_name_snapshot = COALESCE(
    (SELECT b.service_name FROM bookings b WHERE b.id=q.booking_id),
    (SELECT s.name FROM services s WHERE s.id=q.service_id),
    'Unknown service'
  ),
  service_price_snapshot = COALESCE(
    (SELECT b.service_price FROM bookings b WHERE b.id=q.booking_id),
    (SELECT s.current_price FROM services s WHERE s.id=q.service_id),
    0
  );

ALTER TABLE queue_entries ALTER COLUMN service_name_snapshot SET NOT NULL;
ALTER TABLE queue_entries ALTER COLUMN service_price_snapshot SET NOT NULL;
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_service_price_snapshot_check
  CHECK (service_price_snapshot >= 0);

CREATE FUNCTION set_queue_service_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_service_id VARCHAR(80);
  source_service_name VARCHAR(160);
  source_service_price NUMERIC(12,2);
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.service_id, b.service_name, b.service_price
      INTO source_service_id, source_service_name, source_service_price
      FROM bookings b WHERE b.id=NEW.booking_id;
  ELSE
    SELECT s.id, s.name, s.current_price
      INTO source_service_id, source_service_name, source_service_price
      FROM services s WHERE s.id=NEW.service_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unable to snapshot service for queue entry'
      USING ERRCODE='23503';
  END IF;

  NEW.service_id := source_service_id;
  NEW.service_name_snapshot := source_service_name;
  NEW.service_price_snapshot := source_service_price;
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_entries_service_snapshot_before_insert
BEFORE INSERT ON queue_entries
FOR EACH ROW EXECUTE FUNCTION set_queue_service_snapshot();

CREATE FUNCTION prevent_queue_service_snapshot_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_name_snapshot IS DISTINCT FROM OLD.service_name_snapshot
     OR NEW.service_price_snapshot IS DISTINCT FROM OLD.service_price_snapshot THEN
    RAISE EXCEPTION 'Queue service identity and price snapshots cannot be changed'
      USING ERRCODE='23514', CONSTRAINT='queue_entries_service_snapshot_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_entries_service_snapshot_before_update
BEFORE UPDATE OF service_id,service_name_snapshot,service_price_snapshot ON queue_entries
FOR EACH ROW EXECUTE FUNCTION prevent_queue_service_snapshot_change();

-- A live foreign key, when present, must agree with the immutable visit key.
-- The nullable links are allowed to clear after related records are deleted.
ALTER TABLE transactions ADD CONSTRAINT transactions_visit_identity_check CHECK (
  (visit_type='booking' AND queue_entry_id IS NULL AND (booking_id IS NULL OR visit_record_id=booking_id))
  OR (visit_type='queue' AND booking_id IS NULL AND (queue_entry_id IS NULL OR visit_record_id=queue_entry_id))
  OR (visit_type='legacy' AND booking_id IS NULL AND queue_entry_id IS NULL)
);

CREATE FUNCTION validate_new_transaction_visit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked_booking_id BIGINT;
BEGIN
  IF NEW.visit_type='booking' THEN
    IF NEW.booking_id IS NULL OR NEW.queue_entry_id IS NOT NULL OR NEW.visit_record_id<>NEW.booking_id THEN
      RAISE EXCEPTION 'Booking transaction visit identity must match booking_id'
        USING ERRCODE='23514', CONSTRAINT='transactions_visit_identity_check';
    END IF;
  ELSIF NEW.visit_type='queue' THEN
    IF NEW.queue_entry_id IS NULL OR NEW.booking_id IS NOT NULL OR NEW.visit_record_id<>NEW.queue_entry_id THEN
      RAISE EXCEPTION 'Walk-in transaction visit identity must match queue_entry_id'
        USING ERRCODE='23514', CONSTRAINT='transactions_visit_identity_check';
    END IF;
    SELECT q.booking_id INTO linked_booking_id FROM queue_entries q WHERE q.id=NEW.queue_entry_id;
    IF linked_booking_id IS NOT NULL THEN
      RAISE EXCEPTION 'Appointment-linked queue entries must use their booking identity'
        USING ERRCODE='23514', CONSTRAINT='transactions_visit_identity_check';
    END IF;
  ELSE
    RAISE EXCEPTION 'New transactions must reference a booking or a walk-in queue entry'
      USING ERRCODE='23514', CONSTRAINT='transactions_visit_identity_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_visit_identity_before_insert
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION validate_new_transaction_visit();

CREATE FUNCTION prevent_transaction_visit_identity_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.visit_type IS DISTINCT FROM OLD.visit_type
     OR NEW.visit_record_id IS DISTINCT FROM OLD.visit_record_id THEN
    RAISE EXCEPTION 'Transaction visit identity cannot be changed'
      USING ERRCODE='23514', CONSTRAINT='transactions_visit_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_visit_identity_before_update
BEFORE UPDATE OF visit_type,visit_record_id ON transactions
FOR EACH ROW EXECUTE FUNCTION prevent_transaction_visit_identity_change();

-- Phase 1 supports exactly one tender, and it must mirror the transaction
-- header. Deferred checks allow the header and tender to be inserted together.
CREATE UNIQUE INDEX transaction_payments_one_per_transaction
  ON transaction_payments(transaction_id);

CREATE FUNCTION assert_transaction_single_tender_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  checked_transaction_id BIGINT;
  transaction_row RECORD;
  tender_row RECORD;
  tender_count BIGINT;
BEGIN
  IF TG_TABLE_NAME='transactions' THEN
    IF TG_OP='DELETE' THEN checked_transaction_id := OLD.id;
    ELSE checked_transaction_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP='DELETE' THEN checked_transaction_id := OLD.transaction_id;
    ELSE checked_transaction_id := NEW.transaction_id;
    END IF;
  END IF;

  SELECT * INTO transaction_row FROM transactions WHERE id=checked_transaction_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO tender_count FROM transaction_payments WHERE transaction_id=checked_transaction_id;
  IF tender_count <> 1 THEN
    RAISE EXCEPTION 'Transaction % must have exactly one tender', checked_transaction_id
      USING ERRCODE='23514', CONSTRAINT='transaction_tender_consistency';
  END IF;

  SELECT * INTO tender_row FROM transaction_payments WHERE transaction_id=checked_transaction_id;
  IF tender_row.amount IS DISTINCT FROM transaction_row.amount
     OR tender_row.payment_method IS DISTINCT FROM transaction_row.payment_method
     OR tender_row.status IS DISTINCT FROM transaction_row.status THEN
    RAISE EXCEPTION 'Tender for transaction % must match its amount, method, and status', checked_transaction_id
      USING ERRCODE='23514', CONSTRAINT='transaction_tender_consistency';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER transactions_single_tender_consistency
AFTER INSERT OR UPDATE ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_transaction_single_tender_consistency();

CREATE CONSTRAINT TRIGGER transaction_payments_single_tender_consistency
AFTER INSERT OR UPDATE OR DELETE ON transaction_payments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_transaction_single_tender_consistency();
