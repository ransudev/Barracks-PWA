-- Payroll is a separate immutable earnings ledger; revenue reversals never erase it.
CREATE TABLE payroll_settings (
  branch_id INTEGER PRIMARY KEY REFERENCES branches(id) ON DELETE RESTRICT,
  anchor_date DATE NOT NULL,
  configured_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE barber_commission_rates (
  id BIGSERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  old_rate NUMERIC(5,2),
  commission_rate NUMERIC(5,2) NOT NULL CHECK (commission_rate BETWEEN 0 AND 100),
  effective_at TIMESTAMPTZ NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  change_reason TEXT NOT NULL CHECK (length(btrim(change_reason)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(barber_id,effective_at)
);
-- Existing rates are known now, not at historical completion times.
INSERT INTO barber_commission_rates(barber_id,commission_rate,effective_at,change_reason)
SELECT id,commission_rate,clock_timestamp(),'Initial rate at payroll activation; historical rates are unconfirmed'
FROM barbers WHERE commission_rate IS NOT NULL;

CREATE TABLE payroll_service_snapshots (
  id BIGSERIAL PRIMARY KEY,
  visit_type TEXT NOT NULL CHECK (visit_type IN ('booking','queue')),
  visit_record_id BIGINT NOT NULL,
  booking_id BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
  queue_entry_id BIGINT REFERENCES queue_entries(id) ON DELETE SET NULL,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL,
  original_price_centavos BIGINT NOT NULL CHECK (original_price_centavos>=0),
  completed_at TIMESTAMPTZ NOT NULL,
  rate_snapshot NUMERIC(5,2) CHECK (rate_snapshot BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(visit_type,visit_record_id),
  CHECK ((visit_type='booking' AND (booking_id IS NULL OR booking_id=visit_record_id) AND queue_entry_id IS NULL)
    OR (visit_type='queue' AND (queue_entry_id IS NULL OR queue_entry_id=visit_record_id) AND booking_id IS NULL))
);
-- Corrections append evidence. They cannot replace an already-earned snapshot.
CREATE TABLE payroll_snapshot_corrections (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL UNIQUE REFERENCES payroll_service_snapshots(id) ON DELETE RESTRICT,
  rate NUMERIC(5,2) NOT NULL CHECK (rate BETWEEN 0 AND 100),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  approved_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE barber_commission_entries (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL UNIQUE REFERENCES payroll_service_snapshots(id) ON DELETE RESTRICT,
  source_transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  earned_at TIMESTAMPTZ NOT NULL,
  original_price_centavos BIGINT NOT NULL CHECK (original_price_centavos>=0),
  rate_snapshot NUMERIC(5,2) NOT NULL CHECK (rate_snapshot BETWEEN 0 AND 100),
  amount_centavos BIGINT NOT NULL CHECK (amount_centavos>=0),
  service_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX commission_branch_earned_idx ON barber_commission_entries(branch_id,earned_at);
CREATE TABLE payroll_periods (
  id BIGSERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES payroll_settings(branch_id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end_exclusive DATE NOT NULL,
  CHECK (period_end_exclusive=period_start+14),
  UNIQUE(branch_id,period_start),
  UNIQUE(id,branch_id)
);
CREATE TABLE payroll_records (
  id BIGSERIAL PRIMARY KEY,
  payroll_period_id BIGINT NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  supplemental_to BIGINT REFERENCES payroll_records(id) ON DELETE RESTRICT,
  barber_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','paid')),
  gross_centavos BIGINT NOT NULL DEFAULT 0 CHECK (gross_centavos>=0),
  adjustments_centavos BIGINT NOT NULL DEFAULT 0,
  payable_centavos BIGINT NOT NULL DEFAULT 0 CHECK (payable_centavos>=0),
  submitted_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  approver_name TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(payroll_period_id,branch_id) REFERENCES payroll_periods(id,branch_id) ON DELETE RESTRICT,
  CHECK(payable_centavos=gross_centavos+adjustments_centavos),
  CHECK(status NOT IN ('approved','paid') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approver_name IS NOT NULL)),
  CHECK((status='paid')=(paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX payroll_normal_unique ON payroll_records(payroll_period_id,branch_id,barber_id) WHERE supplemental_to IS NULL;
CREATE UNIQUE INDEX payroll_open_supplement_unique ON payroll_records(supplemental_to) WHERE status IN ('draft','pending_approval');
CREATE TABLE payroll_record_entries (
  payroll_record_id BIGINT NOT NULL REFERENCES payroll_records(id) ON DELETE RESTRICT,
  commission_entry_id BIGINT PRIMARY KEY REFERENCES barber_commission_entries(id) ON DELETE RESTRICT
);
CREATE TABLE payroll_adjustments (
  id BIGSERIAL PRIMARY KEY,
  payroll_record_id BIGINT NOT NULL REFERENCES payroll_records(id) ON DELETE RESTRICT,
  source_record_id BIGINT REFERENCES payroll_records(id) ON DELETE RESTRICT,
  amount_centavos BIGINT NOT NULL CHECK(amount_centavos<>0),
  reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE payroll_payments (
  id BIGSERIAL PRIMARY KEY,
  payroll_record_id BIGINT NOT NULL UNIQUE REFERENCES payroll_records(id) ON DELETE RESTRICT,
  amount_centavos BIGINT NOT NULL CHECK(amount_centavos>=0),
  paid_at TIMESTAMPTZ NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','bank_transfer','e_wallet')),
  reference TEXT CHECK(length(reference)<=160),
  recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE payroll_audit_events (
  id BIGSERIAL PRIMARY KEY,
  payroll_record_id BIGINT NOT NULL REFERENCES payroll_records(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION payroll_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='payroll_service_snapshots' THEN
    IF TG_OP='UPDATE' THEN
      IF (to_jsonb(NEW)-ARRAY['booking_id','queue_entry_id'])=(to_jsonb(OLD)-ARRAY['booking_id','queue_entry_id'])
        AND (NEW.booking_id IS NOT DISTINCT FROM OLD.booking_id OR (OLD.booking_id IS NOT NULL AND NEW.booking_id IS NULL))
        AND (NEW.queue_entry_id IS NOT DISTINCT FROM OLD.queue_entry_id OR (OLD.queue_entry_id IS NOT NULL AND NEW.queue_entry_id IS NULL)) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'Payroll audit history is immutable' USING ERRCODE='23514';
END $$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['payroll_settings','barber_commission_rates','payroll_service_snapshots',
    'payroll_snapshot_corrections','barber_commission_entries','payroll_record_entries',
    'payroll_adjustments','payroll_payments','payroll_audit_events','payroll_periods'] LOOP
    EXECUTE format('CREATE TRIGGER payroll_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_immutable()',t);
  END LOOP;
END $$;

CREATE FUNCTION validate_payroll_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anchor DATE; BEGIN
  SELECT anchor_date INTO STRICT anchor FROM payroll_settings WHERE branch_id=NEW.branch_id;
  IF NEW.period_start<anchor OR (NEW.period_start-anchor)%14<>0 THEN
    RAISE EXCEPTION 'Period must follow the configured 14-day calendar' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_period_calendar BEFORE INSERT ON payroll_periods FOR EACH ROW EXECUTE FUNCTION validate_payroll_period();

CREATE FUNCTION snapshot_payroll_completion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE completed TIMESTAMPTZ; rate NUMERIC; BEGIN
  IF NEW.status<>'completed' OR (TG_OP='UPDATE' AND OLD.status='completed') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='queue_entries' THEN
    IF NEW.booking_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  -- Serialize completion and rate changes using the barber row.
  PERFORM 1 FROM barbers WHERE id=NEW.barber_id FOR UPDATE;
  IF TG_TABLE_NAME='queue_entries' THEN completed:=NEW.completed_at; ELSE completed:=clock_timestamp(); END IF;
  SELECT commission_rate INTO rate FROM barber_commission_rates
    WHERE barber_id=NEW.barber_id AND effective_at<=completed ORDER BY effective_at DESC LIMIT 1;
  IF TG_TABLE_NAME='bookings' THEN
    INSERT INTO payroll_service_snapshots(visit_type,visit_record_id,booking_id,barber_id,branch_id,service_name,original_price_centavos,completed_at,rate_snapshot)
    VALUES('booking',NEW.id,NEW.id,NEW.barber_id,NEW.branch_id,NEW.service_name,round(NEW.service_price*100),completed,rate)
    ON CONFLICT(visit_type,visit_record_id) DO NOTHING;
  ELSE
    INSERT INTO payroll_service_snapshots(visit_type,visit_record_id,queue_entry_id,barber_id,branch_id,service_name,original_price_centavos,completed_at,rate_snapshot)
    VALUES('queue',NEW.id,NEW.id,NEW.barber_id,NEW.branch_id,NEW.service_name_snapshot,round(NEW.service_price_snapshot*100),NEW.completed_at,rate)
    ON CONFLICT(visit_type,visit_record_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_booking_completion AFTER INSERT OR UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION snapshot_payroll_completion();
CREATE TRIGGER payroll_queue_completion AFTER INSERT OR UPDATE OF status ON queue_entries FOR EACH ROW EXECUTE FUNCTION snapshot_payroll_completion();
-- Historic completion times/prices come from source snapshots. A manager must
-- confirm their historic rate, rather than assigning today's rate retroactively.
INSERT INTO payroll_service_snapshots(visit_type,visit_record_id,booking_id,barber_id,branch_id,service_name,original_price_centavos,completed_at)
SELECT 'booking',b.id,b.id,b.barber_id,b.branch_id,b.service_name,round(b.service_price*100),COALESCE(q.completed_at,b.updated_at)
FROM bookings b LEFT JOIN queue_entries q ON q.booking_id=b.id WHERE b.status='completed';
INSERT INTO payroll_service_snapshots(visit_type,visit_record_id,queue_entry_id,barber_id,branch_id,service_name,original_price_centavos,completed_at)
SELECT 'queue',id,id,barber_id,branch_id,service_name_snapshot,round(service_price_snapshot*100),completed_at
FROM queue_entries WHERE status='completed' AND booking_id IS NULL;

CREATE FUNCTION accrue_payroll_commission(tx_id BIGINT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE tx RECORD; snap RECORD; rate NUMERIC; payment_time TIMESTAMPTZ; BEGIN
  SELECT * INTO tx FROM transactions WHERE id=tx_id;
  IF NOT FOUND OR tx.status NOT IN ('completed','refunded','partially_refunded') THEN RETURN; END IF;
  SELECT * INTO snap FROM payroll_service_snapshots WHERE visit_type=tx.visit_type AND visit_record_id=tx.visit_record_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF snap.barber_id<>tx.barber_id OR snap.branch_id<>tx.branch_id THEN
    RAISE EXCEPTION 'Commission source ownership mismatch' USING ERRCODE='23514';
  END IF;
  SELECT created_at INTO payment_time FROM transaction_payments WHERE transaction_id=tx.id AND status IN ('completed','refunded','partially_refunded');
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE((SELECT c.rate FROM payroll_snapshot_corrections c WHERE c.snapshot_id=snap.id),snap.rate_snapshot) INTO rate;
  IF rate IS NULL THEN RETURN; END IF;
  INSERT INTO barber_commission_entries(snapshot_id,source_transaction_id,barber_id,branch_id,earned_at,original_price_centavos,rate_snapshot,amount_centavos,service_name)
  VALUES(snap.id,tx.id,snap.barber_id,snap.branch_id,GREATEST(snap.completed_at,payment_time),snap.original_price_centavos,rate,round(snap.original_price_centavos::numeric*rate/100),snap.service_name)
  ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION payroll_payment_accrual() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM accrue_payroll_commission(NEW.transaction_id); RETURN NEW; END $$;
CREATE CONSTRAINT TRIGGER payroll_payment_accrual AFTER INSERT OR UPDATE ON transaction_payments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_accrual();
CREATE FUNCTION payroll_completion_accrual() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tx BIGINT; BEGIN
  SELECT id INTO tx FROM transactions WHERE visit_type=NEW.visit_type AND visit_record_id=NEW.visit_record_id;
  IF tx IS NOT NULL THEN PERFORM accrue_payroll_commission(tx); END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER payroll_completion_accrual AFTER INSERT ON payroll_service_snapshots
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_completion_accrual();
CREATE FUNCTION block_earned_commission_void() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='voided' AND OLD.status='completed' AND (
    EXISTS(SELECT 1 FROM barber_commission_entries WHERE source_transaction_id=NEW.id)
    OR EXISTS(SELECT 1 FROM payroll_service_snapshots WHERE visit_type=NEW.visit_type AND visit_record_id=NEW.visit_record_id)) THEN
    RAISE EXCEPTION 'Post-payment void policy is unconfirmed. Earned-commission transactions cannot be voided; refunds retain commission.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_void_policy BEFORE UPDATE OF status ON transactions FOR EACH ROW EXECUTE FUNCTION block_earned_commission_void();

CREATE FUNCTION guard_payroll_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payroll records cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.paid_at IS NOT NULL THEN
      RAISE EXCEPTION 'New payroll must begin as an unapproved Draft' USING ERRCODE='23514';
    END IF;
    IF NEW.supplemental_to IS NOT NULL THEN
      SELECT * INTO STRICT parent FROM payroll_records WHERE id=NEW.supplemental_to;
      IF parent.status NOT IN ('approved','paid') OR parent.supplemental_to IS NOT NULL OR parent.branch_id<>NEW.branch_id
        OR parent.barber_id<>NEW.barber_id OR parent.payroll_period_id<>NEW.payroll_period_id THEN
        RAISE EXCEPTION 'A supplement must match an approved normal payroll' USING ERRCODE='23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.branch_id<>OLD.branch_id OR NEW.barber_id<>OLD.barber_id OR NEW.payroll_period_id<>OLD.payroll_period_id
    OR NEW.supplemental_to IS DISTINCT FROM OLD.supplemental_to OR NEW.barber_name<>OLD.barber_name OR NEW.branch_name<>OLD.branch_name THEN
    RAISE EXCEPTION 'Payroll identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status='paid' OR (OLD.status='approved' AND (NEW.status<>'paid' OR
    (to_jsonb(NEW)-ARRAY['status','paid_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','paid_at','updated_at']))) THEN
    RAISE EXCEPTION 'Approved payroll breakdown is locked' USING ERRCODE='23514';
  END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='draft' AND NEW.status='pending_approval')
    OR (OLD.status='pending_approval' AND NEW.status IN ('draft','approved')) OR (OLD.status='approved' AND NEW.status='paid')) THEN
    RAISE EXCEPTION 'Invalid payroll transition' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' AND OLD.status<>'approved' AND NOT EXISTS(
    SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id JOIN user_branches ub ON ub.user_id=u.id
    WHERE u.id=NEW.approved_by AND r.name='manager' AND ub.branch_id=NEW.branch_id
      AND u.deleted_at IS NULL AND u.is_verified AND NOT u.is_blocked) THEN
    RAISE EXCEPTION 'An assigned Manager must approve payroll' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_record_guard BEFORE INSERT OR UPDATE OR DELETE ON payroll_records FOR EACH ROW EXECUTE FUNCTION guard_payroll_record();
CREATE FUNCTION guard_payroll_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pr RECORD; owner RECORD; BEGIN
  SELECT * INTO STRICT pr FROM payroll_records WHERE id=NEW.payroll_record_id FOR UPDATE;
  IF TG_TABLE_NAME='payroll_payments' THEN
    IF pr.status<>'approved' OR NEW.amount_centavos<>pr.payable_centavos OR NEW.paid_at<pr.approved_at THEN
      RAISE EXCEPTION 'Record a full payment only after Manager approval' USING ERRCODE='23514';
    END IF;
  ELSE
    IF pr.status<>'draft' THEN RAISE EXCEPTION 'Only draft payroll can change' USING ERRCODE='23514'; END IF;
    IF TG_TABLE_NAME='payroll_adjustments' THEN
      IF NEW.source_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM payroll_records r WHERE r.id=NEW.source_record_id
        AND r.branch_id=pr.branch_id AND r.barber_id=pr.barber_id AND r.status IN ('approved','paid')) THEN
        RAISE EXCEPTION 'A correction source must be approved payroll for the same barber and branch' USING ERRCODE='23514';
      END IF;
    END IF;
    IF TG_TABLE_NAME='payroll_record_entries' THEN
      SELECT * INTO STRICT owner FROM barber_commission_entries WHERE id=NEW.commission_entry_id;
      IF owner.branch_id<>pr.branch_id OR owner.barber_id<>pr.barber_id OR NOT EXISTS(
        SELECT 1 FROM payroll_periods p WHERE p.id=pr.payroll_period_id
        AND owner.earned_at >= (p.period_start::timestamp AT TIME ZONE 'Asia/Manila')
        AND owner.earned_at < (p.period_end_exclusive::timestamp AT TIME ZONE 'Asia/Manila')) THEN
        RAISE EXCEPTION 'Commission must match payroll owner and period' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_entry_guard BEFORE INSERT ON payroll_record_entries FOR EACH ROW EXECUTE FUNCTION guard_payroll_child();
CREATE TRIGGER payroll_adjustment_guard BEFORE INSERT ON payroll_adjustments FOR EACH ROW EXECUTE FUNCTION guard_payroll_child();
CREATE TRIGGER payroll_payment_guard BEFORE INSERT ON payroll_payments FOR EACH ROW EXECUTE FUNCTION guard_payroll_child();

CREATE FUNCTION guard_payroll_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snap RECORD; BEGIN
  SELECT * INTO STRICT snap FROM payroll_service_snapshots WHERE id=NEW.snapshot_id FOR UPDATE;
  IF snap.rate_snapshot IS NOT NULL OR EXISTS(SELECT 1 FROM barber_commission_entries WHERE snapshot_id=snap.id) THEN
    RAISE EXCEPTION 'Earned or confirmed rates require a separately approved adjustment' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id JOIN user_branches ub ON ub.user_id=u.id
    WHERE u.id=NEW.approved_by AND r.name='manager' AND ub.branch_id=snap.branch_id AND u.deleted_at IS NULL AND u.is_verified AND NOT u.is_blocked) THEN
    RAISE EXCEPTION 'An assigned Manager must approve a historical correction' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payroll_correction_guard BEFORE INSERT ON payroll_snapshot_corrections FOR EACH ROW EXECUTE FUNCTION guard_payroll_correction();

-- All master-rate writes must carry an actor and a reason; legacy bulk/editor
-- writes cannot bypass history. Scheduled changes use the history service.
CREATE FUNCTION audit_barber_master_rate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor INTEGER; reason TEXT; previous NUMERIC; BEGIN
  IF TG_OP='UPDATE' AND NEW.commission_rate IS NOT DISTINCT FROM OLD.commission_rate THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.commission_rate IS NULL THEN RETURN NEW; END IF;
  actor:=NULLIF(current_setting('barracks.payroll_actor',true),'')::integer;
  reason:=NULLIF(current_setting('barracks.payroll_reason',true),'');
  IF TG_OP='INSERT' AND actor IS NULL THEN
    INSERT INTO barber_commission_rates(barber_id,commission_rate,effective_at,change_reason)
    VALUES(NEW.id,NEW.commission_rate,clock_timestamp(),'Initial rate at barber creation');
    RETURN NEW;
  END IF;
  IF actor IS NULL OR reason IS NULL THEN
    RAISE EXCEPTION 'Set commission rates through Payroll settings with an audit reason' USING ERRCODE='23514';
  END IF;
  IF NEW.commission_rate IS NULL THEN RAISE EXCEPTION 'A configured commission rate cannot be cleared' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN previous:=OLD.commission_rate; END IF;
  INSERT INTO barber_commission_rates(barber_id,old_rate,commission_rate,effective_at,changed_by,change_reason)
  VALUES(NEW.id,previous,NEW.commission_rate,clock_timestamp(),actor,reason);
  RETURN NEW;
END $$;
CREATE TRIGGER barber_rate_audit AFTER INSERT OR UPDATE OF commission_rate ON barbers FOR EACH ROW EXECUTE FUNCTION audit_barber_master_rate();

CREATE FUNCTION payroll_final_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pr RECORD; tx_id BIGINT; gross NUMERIC; adjustments NUMERIC; payment RECORD; BEGIN
  IF TG_TABLE_NAME='payroll_records' THEN tx_id:=NEW.id; ELSE tx_id:=NEW.payroll_record_id; END IF;
  SELECT * INTO STRICT pr FROM payroll_records WHERE id=tx_id;
  SELECT COALESCE(sum(e.amount_centavos),0) INTO gross FROM payroll_record_entries x JOIN barber_commission_entries e ON e.id=x.commission_entry_id WHERE x.payroll_record_id=pr.id;
  SELECT COALESCE(sum(amount_centavos),0) INTO adjustments FROM payroll_adjustments WHERE payroll_record_id=pr.id;
  IF pr.gross_centavos<>gross OR pr.adjustments_centavos<>adjustments OR pr.payable_centavos<>gross+adjustments THEN
    RAISE EXCEPTION 'Payroll totals must equal their immutable source breakdown' USING ERRCODE='23514';
  END IF;
  SELECT * INTO payment FROM payroll_payments WHERE payroll_record_id=pr.id;
  IF (pr.status='paid')<>FOUND OR (FOUND AND (payment.amount_centavos<>pr.payable_centavos OR payment.paid_at<>pr.paid_at)) THEN
    RAISE EXCEPTION 'Paid payroll must have a matching full disbursement record' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='payroll_records' THEN
    IF TG_OP='UPDATE' AND NEW.status<>OLD.status AND NOT EXISTS(
      SELECT 1 FROM payroll_audit_events WHERE payroll_record_id=pr.id AND action=CASE NEW.status
        WHEN 'draft' THEN 'return' WHEN 'pending_approval' THEN 'submit' WHEN 'approved' THEN 'approve' WHEN 'paid' THEN 'pay' END
        AND created_at>=NEW.updated_at) THEN
      RAISE EXCEPTION 'Every payroll transition requires an audit event' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payroll_totals AFTER INSERT OR UPDATE ON payroll_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_final_consistency();
CREATE CONSTRAINT TRIGGER payroll_entry_totals AFTER INSERT ON payroll_record_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_final_consistency();
CREATE CONSTRAINT TRIGGER payroll_adjustment_totals AFTER INSERT ON payroll_adjustments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_final_consistency();
CREATE CONSTRAINT TRIGGER payroll_paid_consistency AFTER INSERT ON payroll_payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_final_consistency();

-- Barracks authorizes through its server session, not Supabase browser roles.
-- Deny Data API access even on projects with public-schema default grants.
DO $$ DECLARE t TEXT; role_name TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['payroll_settings','barber_commission_rates','payroll_service_snapshots',
    'payroll_snapshot_corrections','barber_commission_entries','payroll_periods','payroll_records',
    'payroll_record_entries','payroll_adjustments','payroll_payments','payroll_audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I',t,role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
