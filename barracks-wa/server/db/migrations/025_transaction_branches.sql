-- Branch belongs to the sale. Tenders and audit actions inherit via transaction_id.
ALTER TABLE transactions ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT;
-- Refuse ambiguous pre-Phase-4 payments rather than rewrite their financial history.
DO $$ DECLARE conflicts TEXT; BEGIN
  SELECT string_agg(t.id::text,', ' ORDER BY t.id) INTO conflicts
  FROM transactions t LEFT JOIN bookings b ON b.id=t.booking_id
  LEFT JOIN queue_entries q ON q.id=t.queue_entry_id
  WHERE COALESCE(b.branch_id,q.branch_id,(SELECT id FROM branches WHERE code='MAIN'))
    <> (SELECT id FROM branches WHERE code='MAIN');
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Review existing non-Main visit transactions before Main Branch backfill: %', conflicts
      USING ERRCODE='23514';
  END IF;
END $$;
-- The migration runner holds this migration in one transaction. Permit only this
-- backfill, then restore the existing finalized-record protection before commit.
ALTER TABLE transactions DISABLE TRIGGER finalized_transaction_protection;
-- Pre-action reversals legitimately have no audit rows. Branch-only backfill
-- must not invoke the newer status/action consistency check on those records.
ALTER TABLE transactions DISABLE TRIGGER transaction_financial_consistency;
UPDATE transactions SET branch_id=(SELECT id FROM branches WHERE code='MAIN');
-- Drain deferred financial checks before further ALTER TABLE operations.
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE transactions ENABLE TRIGGER finalized_transaction_protection;
ALTER TABLE transactions ENABLE TRIGGER transaction_financial_consistency;
ALTER TABLE transactions ALTER COLUMN branch_id SET NOT NULL;
DO $$ DECLARE main_id INTEGER; BEGIN
  SELECT id INTO STRICT main_id FROM branches WHERE code='MAIN';
  EXECUTE format('ALTER TABLE transactions ALTER COLUMN branch_id SET DEFAULT %s',main_id);
END $$;
CREATE INDEX transactions_branch_created_idx ON transactions(branch_id,created_at DESC,id DESC);

CREATE FUNCTION validate_transaction_branch() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner INTEGER;
BEGIN
  IF TG_OP='UPDATE' AND NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Transaction branch ownership cannot be changed'
      USING ERRCODE='23514', CONSTRAINT='transaction_branch_immutable';
  END IF;
  IF NEW.booking_id IS NOT NULL THEN
    SELECT branch_id INTO owner FROM bookings WHERE id=NEW.booking_id FOR SHARE;
    IF owner IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'Transaction branch must match booking branch'
        USING ERRCODE='23514', CONSTRAINT='transaction_visit_branch_match';
    END IF;
  END IF;
  IF NEW.queue_entry_id IS NOT NULL THEN
    SELECT branch_id INTO owner FROM queue_entries WHERE id=NEW.queue_entry_id FOR SHARE;
    IF owner IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'Transaction branch must match queue branch'
        USING ERRCODE='23514', CONSTRAINT='transaction_visit_branch_match';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER transaction_branch_integrity BEFORE INSERT OR UPDATE OF branch_id,booking_id,queue_entry_id ON transactions
FOR EACH ROW EXECUTE FUNCTION validate_transaction_branch();
