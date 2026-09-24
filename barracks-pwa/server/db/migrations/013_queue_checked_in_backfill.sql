-- Phase 4 check-ins may predate the persistent queue migration.
INSERT INTO queue_entries(booking_id, customer_id, service_id, barber_id, status, joined_at, started_at)
SELECT b.id, b.customer_id, b.service_id, b.barber_id,
       CASE WHEN b.status='in_progress' THEN 'in_progress' ELSE 'ready' END,
       b.updated_at,
       CASE WHEN b.status='in_progress' THEN b.updated_at ELSE NULL END
FROM bookings b
WHERE b.status IN ('checked_in', 'in_progress')
ON CONFLICT (booking_id) DO NOTHING;
