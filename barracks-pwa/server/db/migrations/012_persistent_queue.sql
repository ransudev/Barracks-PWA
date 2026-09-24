CREATE TABLE queue_entries (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  service_id VARCHAR(80) NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  barber_id INTEGER REFERENCES barbers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready', 'in_progress', 'completed', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX queue_entries_status_joined_idx ON queue_entries(status, joined_at);
CREATE INDEX queue_entries_customer_idx ON queue_entries(customer_id);
CREATE INDEX queue_entries_barber_idx ON queue_entries(barber_id);
