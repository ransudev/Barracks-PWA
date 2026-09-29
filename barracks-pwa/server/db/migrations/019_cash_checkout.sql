-- Cash tender records the physical amount collected. Historical cash tenders
-- predate this field and are treated as exact payments.
ALTER TABLE transaction_payments ADD COLUMN amount_received NUMERIC(12,2);
ALTER TABLE transaction_payments ADD COLUMN change_amount NUMERIC(12,2);

UPDATE transaction_payments
SET amount_received=amount, change_amount=0
WHERE payment_method='cash';

-- Migration 018's deferred tender checks must finish before altering this table.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE transaction_payments ADD CONSTRAINT transaction_payments_cash_balance_check CHECK (
  (payment_method='cash' AND amount_received IS NOT NULL AND change_amount IS NOT NULL
    AND amount_received >= amount AND change_amount=amount_received-amount)
  OR (payment_method<>'cash' AND amount_received IS NULL AND change_amount IS NULL)
);
