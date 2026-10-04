BEGIN;
DO $$ BEGIN
  IF current_database() <> 'barracks_layout_demo' OR inet_server_addr() <> '127.0.0.1'::inet THEN
    RAISE EXCEPTION 'This fixture is restricted to the isolated local layout demo';
  END IF;
END $$;
UPDATE users SET first_name='Alejandro Maximiliano de la Cruz', last_name='del Rosario Villanueva' WHERE email='demo.customer.jethro@barracks.app';
INSERT INTO bookings (customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status,service_duration_minutes,end_time,notes,demo_key)
SELECT (SELECT customer_id FROM bookings WHERE id=159),barber_id,service_id,service_name,service_price,booking_date,'10:15','cancelled',45,'11:00','Synthetic historical overlap and long-name rendering fixture','layout-edge-overlap' FROM bookings WHERE id=1;
INSERT INTO bookings (customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status,service_duration_minutes,end_time,notes,demo_key)
SELECT customer_id,barber_id,service_id,service_name,service_price,booking_date,'14:00','cancelled',NULL,NULL,'Synthetic legacy duration-unavailable rendering fixture','layout-edge-unknown-duration' FROM bookings WHERE id=1;
COMMIT;
