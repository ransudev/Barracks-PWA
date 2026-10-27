ALTER TABLE customers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE customers ADD COLUMN first_name VARCHAR(100);
ALTER TABLE customers ADD COLUMN last_name VARCHAR(100);

ALTER TABLE customers
  ADD CONSTRAINT customers_walkin_name_check
  CHECK (
    user_id IS NOT NULL OR (
      first_name IS NOT NULL AND length(btrim(first_name)) > 0 AND
      last_name IS NOT NULL AND length(btrim(last_name)) > 0
    )
  );

ALTER TABLE queue_entries ADD COLUMN idempotency_key UUID;
ALTER TABLE queue_entries ADD COLUMN idempotency_fingerprint CHAR(64);

ALTER TABLE queue_entries
  ADD CONSTRAINT queue_entries_idempotency_pair_check
  CHECK ((idempotency_key IS NULL) = (idempotency_fingerprint IS NULL));

CREATE UNIQUE INDEX queue_entries_idempotency_key_unique
  ON queue_entries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
