-- Synthetic operational activity for a demo database with migrations 001-021.
-- Run inside a transaction. Stable keys preserve staff edits on subsequent runs.
SELECT pg_advisory_xact_lock(20261003, 1);
DO $$
#variable_conflict use_variable
DECLARE
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date;
  actor_id INTEGER;
  cashier TEXT;
  customer_ids INTEGER[];
  barber_ids INTEGER[];
  service_ids TEXT[] := ARRAY['barracks-basic','signature-shave','barracks-premium'];
  person RECORD;
  svc RECORD;
  customer_id INTEGER;
  barber_id INTEGER;
  booking_id BIGINT;
  transaction_id BIGINT;
  entry_id BIGINT;
  day_offset INTEGER;
  slot INTEGER;
  visit_date DATE;
  visit_time TIME;
  occurred_at TIMESTAMPTZ;
  visit_key TEXT;
  visit_status TEXT;
  method TEXT;
  queue_status TEXT;
BEGIN
  SELECT u.id,concat_ws(' ',u.first_name,u.last_name) INTO actor_id,cashier
  FROM users u JOIN roles r ON r.id=u.role_id
  WHERE u.deleted_at IS NULL AND NOT u.is_blocked AND r.name IN ('front_desk','administrator')
  ORDER BY (u.email='demo.frontdesk@barracks.app') DESC,u.id LIMIT 1;
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Demo activity requires an active staff account'; END IF;
  SELECT array_agg(b.id ORDER BY d.position) INTO barber_ids
  FROM (VALUES (1,'Miko','Reyes'),(2,'Paolo','Santos'),(3,'Andrei','Villanueva')) d(position,first_name,last_name)
  JOIN barbers b ON b.first_name=d.first_name AND b.last_name=d.last_name;
  IF coalesce(array_length(barber_ids,1),0) <> 3 THEN
    RAISE EXCEPTION 'Demo activity requires the original Miko, Paolo, and Andrei roster';
  END IF;
  IF (SELECT count(*) FROM services WHERE id=ANY(service_ids) AND active AND duration_minutes IS NOT NULL) <> 3 THEN
    RAISE EXCEPTION 'Demo activity requires all three active demo services';
  END IF;

  -- Accountless walk-ins: these are customer profiles, never fabricated logins.
  FOR person IN SELECT * FROM (VALUES
    ('Miguel','Torres','+63 917 555 0301'),('Carlo','Mendoza','+63 917 555 0302'),
    ('Adrian','Flores','+63 917 555 0303'),('Nico','Garcia','+63 917 555 0304'),
    ('Diego','Ramos','+63 917 555 0305'),('Enzo','Castillo','+63 917 555 0306'),
    ('Gabriel','Tan','+63 917 555 0307'),('Marco','Bautista','+63 917 555 0308'),
    ('Joshua','Aquino','+63 917 555 0309'),('Rico','Navarro','+63 917 555 0310'),
    ('Sebastian','Reyes','+63 917 555 0311'),('Daniel','Ong','+63 917 555 0312')
  ) p(first_name,last_name,phone) LOOP
    INSERT INTO customers(first_name,last_name,phone,preferred_barber_id,loyalty_points)
    SELECT person.first_name,person.last_name,person.phone,
      barber_ids[1 + (right(person.phone,2)::integer % 3)],0
    WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.user_id IS NULL AND c.phone=person.phone);
  END LOOP;
  SELECT array_agg(c.id ORDER BY c.id) INTO customer_ids FROM customers c LEFT JOIN users u ON u.id=c.user_id
  WHERE (u.email IN ('demo.customer.ana@barracks.app','demo.customer.paulo@barracks.app',
    'demo.customer.samira@barracks.app','demo.customer.jethro@barracks.app') AND u.deleted_at IS NULL AND NOT u.is_blocked)
    OR (c.user_id IS NULL AND c.phone LIKE '+63 917 555 03__');

  -- Four weeks of varied visits, plus the coming week. Dates follow Manila.
  -- Existing appointments are checked before adding future slots.
  FOR day_offset IN -28..7 LOOP
    IF day_offset=0 THEN CONTINUE; END IF;
    visit_date := today + day_offset;
    FOR slot IN 0..(CASE WHEN day_offset<0 THEN 3 + abs(day_offset)%4 ELSE 1 END) LOOP
      customer_id := customer_ids[1 + ((abs(day_offset)*3+slot) % array_length(customer_ids,1))];
      barber_id := barber_ids[1 + slot%3];
      SELECT * INTO STRICT svc FROM services WHERE id=service_ids[1 + (abs(day_offset)+slot)%3];
      visit_time := TIME '09:30' + slot * INTERVAL '75 minutes';
      occurred_at := (visit_date + visit_time) AT TIME ZONE 'Asia/Manila';
      visit_key := 'demo-working-' || visit_date::text || '-' || slot;
      IF EXISTS (SELECT 1 FROM bookings b WHERE b.demo_key=visit_key) THEN CONTINUE; END IF;
      visit_status := CASE WHEN day_offset>0 THEN 'confirmed'
        WHEN (abs(day_offset)+slot)%19=0 THEN 'cancelled'
        WHEN (abs(day_offset)+slot)%23=0 THEN 'no_show' ELSE 'completed' END;
      IF day_offset>0 AND (
        EXISTS (SELECT 1 FROM bookings b WHERE b.status IN ('confirmed','checked_in','in_progress')
          AND (b.barber_id=barber_id OR b.customer_id=customer_id)
          AND b.booking_date=visit_date
          AND tsrange(b.booking_date+b.booking_time,
            CASE WHEN b.service_duration_minutes IS NULL THEN b.booking_date::timestamp+INTERVAL '1 day'
              ELSE b.booking_date+b.booking_time+b.service_duration_minutes*INTERVAL '1 minute' END,'[)')
            && tsrange(visit_date+visit_time,visit_date+visit_time+svc.duration_minutes*INTERVAL '1 minute','[)'))
        OR NOT EXISTS (SELECT 1 FROM barber_schedules bs JOIN shop_operating_hours h ON h.day_of_week=bs.day_of_week
          WHERE bs.barber_id=barber_id AND bs.day_of_week=extract(dow FROM visit_date) AND bs.is_working AND NOT h.is_closed
            AND visit_time>=greatest(bs.start_time,h.open_time)
            AND visit_time+svc.duration_minutes*INTERVAL '1 minute'<=least(bs.end_time,h.close_time))
        OR EXISTS (SELECT 1 FROM barber_schedules bs JOIN barber_schedule_breaks br ON br.barber_schedule_id=bs.id
          WHERE bs.barber_id=barber_id AND bs.day_of_week=extract(dow FROM visit_date)
            AND visit_time<br.end_time AND visit_time+svc.duration_minutes*INTERVAL '1 minute'>br.start_time)
        OR EXISTS (SELECT 1 FROM barber_unavailability bu WHERE bu.barber_id=barber_id
          AND bu.starts_at<occurred_at+svc.duration_minutes*INTERVAL '1 minute' AND bu.ends_at>occurred_at)
      ) THEN CONTINUE; END IF;
      INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,
        booking_date,booking_time,end_time,status,demo_key,notes,created_at,updated_at)
      VALUES(customer_id,barber_id,svc.id,svc.name,svc.current_price,svc.duration_minutes,visit_date,visit_time,
        visit_time+svc.duration_minutes*INTERVAL '1 minute',visit_status,visit_key,
        CASE slot%3 WHEN 0 THEN 'Low taper, keep some length on top.' WHEN 1 THEN 'Regular trim before work.' ELSE 'Clean neckline and natural finish.' END,
        occurred_at-INTERVAL '2 days',CASE WHEN day_offset<0 THEN occurred_at+svc.duration_minutes*INTERVAL '1 minute' ELSE occurred_at-INTERVAL '2 days' END)
      RETURNING id INTO booking_id;
      IF visit_status<>'completed' THEN CONTINUE; END IF;
      method := (ARRAY['cash','cash','e_wallet','card'])[1+(abs(day_offset)+slot)%4];
      occurred_at := occurred_at+svc.duration_minutes*INTERVAL '1 minute';
      INSERT INTO transactions(customer_id,booking_id,visit_type,visit_record_id,barber_id,service_id,amount,
        payment_method,status,customer_name,barber_name,service_name,processed_by,cashier_name,created_at)
      SELECT c.id,booking_id,'booking',booking_id,b.id,svc.id,svc.current_price,method,'completed',
        concat_ws(' ',coalesce(u.first_name,c.first_name),coalesce(u.last_name,c.last_name)),
        concat_ws(' ',b.first_name,b.last_name),svc.name,actor_id,cashier,occurred_at
      FROM customers c LEFT JOIN users u ON u.id=c.user_id JOIN barbers b ON b.id=barber_id WHERE c.id=customer_id
      RETURNING id INTO transaction_id;
      INSERT INTO transaction_payments(transaction_id,payment_method,amount,status,amount_received,change_amount,created_at)
      VALUES(transaction_id,method,svc.current_price,'completed',
        CASE WHEN method='cash' THEN ceil(svc.current_price/100)*100 END,
        CASE WHEN method='cash' THEN ceil(svc.current_price/100)*100-svc.current_price END,occurred_at);
      UPDATE barbers b SET services_done=b.services_done+1,revenue=b.revenue+svc.current_price WHERE b.id=barber_id;
    END LOOP;
  END LOOP;

  -- Attendance history includes punctual, late, and absent shifts.
  INSERT INTO barber_attendance(barber_id,attendance_date,status,clock_in,clock_out,recorded_by,updated_by,created_at,updated_at)
  SELECT b.id,today-d,
    CASE WHEN b.first_name='Luis' AND d%5=0 THEN 'absent' WHEN (b.id+d)%7=0 THEN 'late' ELSE 'present' END,
    CASE WHEN b.first_name='Luis' AND d%5=0 THEN NULL ELSE ((today-d)+TIME '08:50'+
      CASE WHEN (b.id+d)%7=0 THEN INTERVAL '35 minutes' ELSE INTERVAL '0 minutes' END) AT TIME ZONE 'Asia/Manila' END,
    CASE WHEN b.first_name='Luis' AND d%5=0 THEN NULL ELSE ((today-d)+TIME '19:30') AT TIME ZONE 'Asia/Manila' END,
    actor_id,actor_id,((today-d)+TIME '08:50') AT TIME ZONE 'Asia/Manila',((today-d)+TIME '19:30') AT TIME ZONE 'Asia/Manila'
  FROM barbers b CROSS JOIN generate_series(1,14) d
  WHERE b.id=ANY(barber_ids) OR (b.first_name='Luis' AND b.last_name='Dela Cruz')
  ON CONFLICT DO NOTHING;
  INSERT INTO barber_attendance(barber_id,attendance_date,status,clock_in,recorded_by,updated_by)
  SELECT b.id,today,CASE WHEN b.first_name='Luis' THEN 'absent' WHEN b.first_name='Paolo' THEN 'late' ELSE 'present' END,
    CASE WHEN b.first_name='Luis' THEN NULL ELSE CURRENT_TIMESTAMP END,actor_id,actor_id
  FROM barbers b WHERE b.id=ANY(barber_ids) OR (b.first_name='Luis' AND b.last_name='Dela Cruz')
  ON CONFLICT DO NOTHING;

  -- A lived-in queue: waiting, assigned, serving, and completed awaiting checkout.
  FOR slot IN 1..6 LOOP
    SELECT c.id INTO STRICT customer_id FROM customers c WHERE c.user_id IS NULL
      AND c.phone='+63 917 555 03' || lpad(slot::text,2,'0');
    IF EXISTS (SELECT 1 FROM queue_entries q WHERE q.customer_id=customer_id
      AND (q.status IN ('waiting','ready','in_progress') OR (q.created_at AT TIME ZONE 'Asia/Manila')::date=today)) THEN CONTINUE; END IF;
    queue_status := CASE slot WHEN 1 THEN 'in_progress' WHEN 2 THEN 'ready' WHEN 6 THEN 'completed' ELSE 'waiting' END;
    barber_id := CASE slot WHEN 1 THEN barber_ids[2] WHEN 2 THEN barber_ids[1] WHEN 6 THEN barber_ids[3] ELSE NULL END;
    IF barber_id IS NOT NULL AND queue_status IN ('ready','in_progress') AND (
      EXISTS (SELECT 1 FROM queue_entries q WHERE q.barber_id=barber_id AND q.status IN ('ready','in_progress'))
      OR EXISTS (SELECT 1 FROM bookings b WHERE b.barber_id=barber_id AND b.status='in_progress')
      OR EXISTS (SELECT 1 FROM barbers b WHERE b.id=barber_id AND b.status='unavailable')
      OR NOT EXISTS (SELECT 1 FROM barber_attendance a WHERE a.barber_id=barber_id AND a.attendance_date=today
        AND a.status IN ('present','late') AND a.clock_in IS NOT NULL AND a.clock_out IS NULL)
    ) THEN queue_status := 'waiting'; barber_id := NULL; END IF;
    SELECT * INTO STRICT svc FROM services WHERE id=service_ids[1+slot%3];
    INSERT INTO queue_entries(customer_id,barber_id,service_id,status,joined_at,started_at,completed_at,created_at,updated_at)
    VALUES(customer_id,barber_id,svc.id,queue_status,CURRENT_TIMESTAMP-(40-slot*3)*INTERVAL '1 minute',
      CASE WHEN queue_status IN ('in_progress','completed') THEN CURRENT_TIMESTAMP-INTERVAL '20 minutes' END,
      CASE WHEN queue_status='completed' THEN CURRENT_TIMESTAMP-INTERVAL '2 minutes' END,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    RETURNING id INTO entry_id;
    IF queue_status='in_progress' THEN UPDATE barbers b SET status='busy',updated_at=NOW() WHERE b.id=barber_id; END IF;
  END LOOP;
END;
$$;
