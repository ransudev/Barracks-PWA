-- The original sale and tender remain intact; actions are append-only.
CREATE TABLE transaction_financial_actions (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('refund','void')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  staff_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  staff_name VARCHAR(240) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX transaction_financial_actions_transaction_idx ON transaction_financial_actions(transaction_id,created_at,id);

CREATE FUNCTION prevent_financial_action_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial actions are immutable'
    USING ERRCODE='23514', CONSTRAINT='financial_action_immutable';
END;
$$;
CREATE TRIGGER financial_action_immutable BEFORE UPDATE OR DELETE ON transaction_financial_actions
FOR EACH ROW EXECUTE FUNCTION prevent_financial_action_change();

CREATE FUNCTION protect_finalized_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Finalized financial records cannot be deleted'
      USING ERRCODE='23514', CONSTRAINT='finalized_financial_record_immutable';
  END IF;
  IF TG_TABLE_NAME='transactions' THEN
    IF (to_jsonb(NEW) - 'status' - 'customer_id' - 'booking_id' - 'queue_entry_id' - 'barber_id' - 'service_id' - 'processed_by')
         IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'customer_id' - 'booking_id' - 'queue_entry_id' - 'barber_id' - 'service_id' - 'processed_by')
       OR (NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NOT (OLD.customer_id IS NOT NULL AND NEW.customer_id IS NULL))
       OR (NEW.booking_id IS DISTINCT FROM OLD.booking_id AND NOT (OLD.booking_id IS NOT NULL AND NEW.booking_id IS NULL))
       OR (NEW.queue_entry_id IS DISTINCT FROM OLD.queue_entry_id AND NOT (OLD.queue_entry_id IS NOT NULL AND NEW.queue_entry_id IS NULL))
       OR (NEW.barber_id IS DISTINCT FROM OLD.barber_id AND NOT (OLD.barber_id IS NOT NULL AND NEW.barber_id IS NULL))
       OR (NEW.service_id IS DISTINCT FROM OLD.service_id AND NOT (OLD.service_id IS NOT NULL AND NEW.service_id IS NULL))
       OR (NEW.processed_by IS DISTINCT FROM OLD.processed_by AND NOT (OLD.processed_by IS NOT NULL AND NEW.processed_by IS NULL))
       OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='completed' AND NEW.status IN ('refunded','voided'))) THEN
      RAISE EXCEPTION 'Finalized transaction can only change to refunded or voided'
        USING ERRCODE='23514', CONSTRAINT='finalized_financial_record_immutable';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status')
       OR NOT (OLD.status='completed' AND NEW.status IN ('refunded','voided')) THEN
      RAISE EXCEPTION 'Finalized tender can only change to refunded or voided'
        USING ERRCODE='23514', CONSTRAINT='finalized_financial_record_immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finalized_transaction_protection BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW WHEN (OLD.status IN ('completed','refunded','voided')) EXECUTE FUNCTION protect_finalized_transaction();
CREATE TRIGGER finalized_tender_protection BEFORE UPDATE OR DELETE ON transaction_payments
FOR EACH ROW WHEN (OLD.status IN ('completed','refunded','voided')) EXECUTE FUNCTION protect_finalized_transaction();

CREATE FUNCTION assert_financial_action_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tx RECORD; action_count BIGINT; action_amount NUMERIC(12,2); action_type VARCHAR(10); checked_id BIGINT;
BEGIN
  IF TG_TABLE_NAME='transactions' THEN checked_id := NEW.id;
  ELSE checked_id := NEW.transaction_id;
  END IF;
  SELECT id,amount,status INTO tx FROM transactions WHERE id=checked_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*),coalesce(sum(amount),0),min(a.action_type)
    INTO action_count,action_amount,action_type FROM transaction_financial_actions a WHERE a.transaction_id=checked_id;
  IF tx.status IN ('refunded','voided') THEN
    IF action_count<>1 OR (tx.status='refunded' AND action_type IS DISTINCT FROM 'refund')
       OR (tx.status='voided' AND action_type IS DISTINCT FROM 'void')
       OR action_amount IS DISTINCT FROM tx.amount THEN
      RAISE EXCEPTION 'Refund or void requires a matching full-amount audit action'
        USING ERRCODE='23514', CONSTRAINT='financial_action_consistency';
    END IF;
  ELSIF action_count<>0 THEN
    RAISE EXCEPTION 'Financial action requires a matching transaction status'
      USING ERRCODE='23514', CONSTRAINT='financial_action_consistency';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER transaction_financial_consistency AFTER INSERT OR UPDATE ON transactions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_financial_action_consistency();
CREATE CONSTRAINT TRIGGER tender_financial_consistency AFTER UPDATE ON transaction_payments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_financial_action_consistency();
CREATE CONSTRAINT TRIGGER action_financial_consistency AFTER INSERT ON transaction_financial_actions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_financial_action_consistency();
