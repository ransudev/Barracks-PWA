-- A transaction is the sale for one visit. The child table holds its tenders so
-- later split payments and refunds need no change to the visit identity.
ALTER TABLE transactions ADD COLUMN reference VARCHAR(64);
ALTER TABLE transactions ADD COLUMN queue_entry_id BIGINT REFERENCES queue_entries(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN visit_type VARCHAR(20);
ALTER TABLE transactions ADD COLUMN visit_record_id BIGINT;
ALTER TABLE transactions ADD COLUMN processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(240);
ALTER TABLE transactions ADD COLUMN barber_name VARCHAR(240);
ALTER TABLE transactions ADD COLUMN cashier_name VARCHAR(240);
ALTER TABLE transactions ADD COLUMN service_name VARCHAR(160);
ALTER TABLE transactions ADD COLUMN legacy_payment_method VARCHAR(40);
ALTER TABLE transactions ADD COLUMN legacy_status VARCHAR(20);

UPDATE transactions t SET
  reference = 'TX-LEGACY-' || t.id,
  visit_type = CASE WHEN t.booking_id IS NOT NULL THEN 'booking' ELSE 'legacy' END,
  visit_record_id = COALESCE(t.booking_id,t.id),
  customer_name = COALESCE((SELECT NULLIF(btrim(concat_ws(' ', COALESCE(u.first_name,c.first_name), COALESCE(u.last_name,c.last_name))), '')
    FROM customers c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=t.customer_id), 'Unknown customer'),
  barber_name = COALESCE((SELECT concat_ws(' ', first_name, last_name) FROM barbers WHERE id=t.barber_id), 'Unknown barber'),
  service_name = COALESCE((SELECT service_name FROM bookings WHERE id=t.booking_id),
    (SELECT name FROM services WHERE id=t.service_id), 'Unknown service');

UPDATE transactions SET
  legacy_payment_method = CASE WHEN payment_method NOT IN ('cash','card','e_wallet','bank_transfer') THEN payment_method END,
  payment_method = CASE WHEN payment_method IN ('cash','card','e_wallet','bank_transfer') THEN payment_method ELSE 'other' END,
  legacy_status = CASE WHEN status NOT IN ('pending','completed','failed','voided','partially_refunded','refunded') THEN status END,
  status = CASE WHEN status IN ('pending','completed','failed','voided','partially_refunded','refunded') THEN status ELSE 'unknown' END;

ALTER TABLE transactions ALTER COLUMN reference SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN visit_type SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN visit_record_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN reference SET DEFAULT ('TX-' || upper(replace(gen_random_uuid()::text, '-', '')));
ALTER TABLE transactions ALTER COLUMN customer_name SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN barber_name SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN service_name SET NOT NULL;
ALTER TABLE transactions ADD CONSTRAINT transactions_method_check CHECK (payment_method IN ('cash','card','e_wallet','bank_transfer','other','mixed'));
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed','failed','voided','partially_refunded','refunded','unknown'));
ALTER TABLE transactions ADD CONSTRAINT transactions_visit_type_check CHECK (visit_type IN ('booking','queue','legacy'));
ALTER TABLE transactions ADD CONSTRAINT transactions_visit_record_positive CHECK (visit_record_id > 0);
CREATE UNIQUE INDEX transactions_reference_unique ON transactions(reference);
CREATE UNIQUE INDEX transactions_visit_unique ON transactions(visit_type,visit_record_id) WHERE visit_type <> 'legacy';
CREATE UNIQUE INDEX transactions_booking_unique ON transactions(booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX transactions_queue_unique ON transactions(queue_entry_id) WHERE queue_entry_id IS NOT NULL;

CREATE TABLE transaction_payments (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_method VARCHAR(40) NOT NULL CHECK (payment_method IN ('cash','card','e_wallet','bank_transfer','other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending','completed','failed','voided','partially_refunded','refunded','unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX transaction_payments_transaction_idx ON transaction_payments(transaction_id);

INSERT INTO transaction_payments(transaction_id,payment_method,amount,status)
SELECT id,payment_method,amount,status FROM transactions;
