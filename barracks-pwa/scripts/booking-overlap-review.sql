-- Read-only review for databases stopped at migration 010. Each row is a
-- conflicting pair. Staff must decide which appointment to change and record
-- that decision before rerunning migration 011; this script changes no data.
WITH active AS (
  SELECT id, barber_id, customer_id, booking_date, booking_time, status,
    tsrange(
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp ELSE booking_date + booking_time END,
      CASE WHEN service_duration_minutes IS NULL THEN booking_date::timestamp + INTERVAL '1 day'
           ELSE booking_date + booking_time + service_duration_minutes * INTERVAL '1 minute' END,
      '[)') AS appointment_range
  FROM bookings WHERE status IN ('confirmed', 'checked_in', 'in_progress')
)
SELECT a.id AS first_booking_id, b.id AS second_booking_id,
  CASE WHEN a.barber_id = b.barber_id AND a.customer_id = b.customer_id THEN 'barber and customer'
       WHEN a.barber_id = b.barber_id THEN 'barber' ELSE 'customer' END AS conflict_type,
  a.barber_id AS first_barber_id, b.barber_id AS second_barber_id,
  a.customer_id AS first_customer_id, b.customer_id AS second_customer_id,
  a.appointment_range AS first_range, b.appointment_range AS second_range,
  a.status AS first_status, b.status AS second_status
FROM active a JOIN active b ON a.id < b.id AND a.appointment_range && b.appointment_range
WHERE a.barber_id = b.barber_id OR a.customer_id = b.customer_id
ORDER BY a.id, b.id;
