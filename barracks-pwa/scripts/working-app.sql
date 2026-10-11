-- Additive multi-branch demonstration fixtures, after migration 028.
-- Run only through seed-working-app.ts in its preservation-checked transaction.
DO $$
#variable_conflict use_variable
DECLARE
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date;
  branch_row RECORD; barber_row RECORD; source_row RECORD; svc RECORD;
  actor_id INTEGER; cashier TEXT; customer_ids INTEGER[]; barber_ids INTEGER[];
  person INTEGER; day_offset INTEGER; slot INTEGER; customer_id INTEGER;
  barber_id INTEGER; entry_id BIGINT; tx_id BIGINT; visit_date DATE;
  visit_time TIME; occurred_at TIMESTAMPTZ; completed_time TIMESTAMPTZ;
  fixture_key TEXT; method TEXT; queue_status TEXT; branch_sku TEXT; visit_status TEXT;
BEGIN
  SELECT u.id,concat_ws(' ',u.first_name,u.last_name) INTO STRICT actor_id,cashier
  FROM users u JOIN roles r ON r.id=u.role_id
  WHERE u.email='demo.frontdesk@barracks.app' AND r.name='front_desk'
    AND u.deleted_at IS NULL AND u.is_verified AND NOT u.is_blocked;

  FOR branch_row IN SELECT * FROM branches
    WHERE status='active' AND (code='MAIN' OR name IN
      ('Barracks Bajada HQ','Barracks Lanang HQ','Barracks Bangkal HQ','Barracks Maa HQ'))
    ORDER BY id LOOP
    -- Add two distinct demo barbers in satellite branches; do not edit the roster.
    IF branch_row.code<>'MAIN' THEN
      FOR person IN 1..2 LOOP
        INSERT INTO barbers(first_name,last_name,status,commission_rate,services_done,revenue,rating,branch_id)
        SELECT 'Demo',branch_row.code || CASE person WHEN 1 THEN ' Assistant' ELSE ' Stylist' END,
          'available',CASE person WHEN 1 THEN 42.5 ELSE 45 END,0,0,4.7,branch_row.id
        WHERE NOT EXISTS(SELECT 1 FROM barbers b WHERE b.branch_id=branch_row.id AND b.first_name='Demo'
          AND b.last_name=branch_row.code || CASE person WHEN 1 THEN ' Assistant' ELSE ' Stylist' END);
      END LOOP;
    END IF;
    SELECT array_agg(b.id ORDER BY b.id) INTO barber_ids FROM barbers b
    WHERE b.branch_id=branch_row.id AND
      ((branch_row.code='MAIN' AND (b.first_name,b.last_name) IN
        (('Miko','Reyes'),('Paolo','Santos'),('Andrei','Villanueva')))
      OR (branch_row.code<>'MAIN' AND b.first_name='Demo'));
    IF coalesce(array_length(barber_ids,1),0)<>3 THEN
      RAISE EXCEPTION 'Expected exactly three demo barbers in %',branch_row.name;
    END IF;
    -- Fill missing schedules using this branch's actual hours. Never reset edits.
    INSERT INTO barber_schedules(barber_id,day_of_week,is_working,start_time,end_time)
    SELECT b.id,h.day_of_week,NOT h.is_closed,h.open_time,h.close_time
    FROM barbers b JOIN shop_operating_hours h ON h.branch_id=b.branch_id
    WHERE b.id=ANY(barber_ids) ON CONFLICT DO NOTHING;

    -- Unique accountless profiles per branch keep simultaneous demos independent.
    FOR person IN 1..8 LOOP
      INSERT INTO customers(first_name,last_name,phone,preferred_barber_id,loyalty_points)
      SELECT (ARRAY['Miguel','Carlo','Adrian','Nico','Diego','Enzo','Gabriel','Rico'])[person],
        'Demo ' || branch_row.code,'+63 917 556 ' || lpad(branch_row.id::text,2,'0') || lpad(person::text,2,'0'),
        barber_ids[1+(person-1)%3],person*15
      WHERE NOT EXISTS(SELECT 1 FROM customers c WHERE c.user_id IS NULL
        AND c.phone='+63 917 556 ' || lpad(branch_row.id::text,2,'0') || lpad(person::text,2,'0'));
    END LOOP;
    SELECT array_agg(c.id ORDER BY c.id) INTO customer_ids FROM customers c
    WHERE c.user_id IS NULL AND c.phone LIKE '+63 917 556 ' || lpad(branch_row.id::text,2,'0') || '__';

    -- Stock the full original catalog, preserving quantities and receiving history.
    IF branch_row.code<>'MAIN' THEN
      FOR source_row IN SELECT i.* FROM inventory_items i JOIN branches b ON b.id=i.branch_id
        WHERE b.code='MAIN' AND i.status='active' AND (i.sku LIKE 'BRX-%' OR i.sku LIKE 'NS-%' OR i.sku LIKE 'DBE-%') LOOP
        branch_sku:='DEMO-' || upper(split_part(branch_row.name,' ',2)) || '-' || source_row.sku;
        INSERT INTO inventory_items(name,category,quantity,minimum_stock,maximum_stock,unit_cost,unit,sku,status,supplier_id,image_url,branch_id)
        SELECT source_row.name,source_row.category,least(source_row.maximum_stock,CASE WHEN source_row.id%7=0 THEN 0
          WHEN source_row.id%5=0 THEN 6 ELSE 24 END),
          source_row.minimum_stock,source_row.maximum_stock,source_row.unit_cost,source_row.unit,
          branch_sku,'active',source_row.supplier_id,source_row.image_url,branch_row.id
        WHERE NOT EXISTS(SELECT 1 FROM inventory_items i WHERE i.branch_id=branch_row.id AND lower(i.sku)=lower(branch_sku));
      END LOOP;
    END IF;

    -- Historical walk-ins use their real fixture completion timestamps. Unlike
    -- live booking completion, this can represent past dates without bypassing triggers.
    FOR day_offset IN -35..0 LOOP
      visit_date:=today+day_offset;
      FOR slot IN 0..2 LOOP
        customer_id:=customer_ids[1+(abs(day_offset)+slot)%array_length(customer_ids,1)];
        barber_id:=barber_ids[1+slot];
        SELECT * INTO STRICT svc FROM services
          WHERE id=(ARRAY['barracks-basic','signature-shave','barracks-premium'])[1+(abs(day_offset)+slot)%3] AND active;
        visit_time:=TIME '09:30'+slot*INTERVAL '120 minutes';
        occurred_at:=(visit_date+visit_time) AT TIME ZONE 'Asia/Manila';
        completed_time:=occurred_at+svc.duration_minutes*INTERVAL '1 minute';
        IF completed_time>clock_timestamp() THEN CONTINUE; END IF;
        fixture_key:='demo-app-history-' || branch_row.id || '-' || visit_date || '-' || slot;
        IF EXISTS(SELECT 1 FROM queue_entries q WHERE q.idempotency_key=md5(fixture_key)::uuid) THEN CONTINUE; END IF;
        INSERT INTO queue_entries(customer_id,barber_id,service_id,status,joined_at,started_at,completed_at,
          created_at,updated_at,branch_id,idempotency_key,idempotency_fingerprint)
        VALUES(customer_id,barber_id,svc.id,'completed',occurred_at-INTERVAL '10 minutes',occurred_at,
          completed_time,occurred_at,completed_time,branch_row.id,md5(fixture_key)::uuid,fixture_key)
        RETURNING id INTO entry_id;
        method:=(ARRAY['cash','card','e_wallet'])[1+(abs(day_offset)+slot)%3];
        INSERT INTO transactions(customer_id,queue_entry_id,visit_type,visit_record_id,barber_id,service_id,amount,
          payment_method,status,customer_name,barber_name,service_name,processed_by,cashier_name,created_at,branch_id)
        SELECT c.id,entry_id,'queue',entry_id,b.id,svc.id,svc.current_price,method,'completed',
          concat_ws(' ',c.first_name,c.last_name),concat_ws(' ',b.first_name,b.last_name),svc.name,
          actor_id,cashier,completed_time,branch_row.id FROM customers c CROSS JOIN barbers b
        WHERE c.id=customer_id AND b.id=barber_id RETURNING id INTO tx_id;
        INSERT INTO transaction_payments(transaction_id,payment_method,amount,status,amount_received,change_amount,created_at)
        VALUES(tx_id,method,svc.current_price,'completed',
          CASE WHEN method='cash' THEN ceil(svc.current_price/100)*100 END,
          CASE WHEN method='cash' THEN ceil(svc.current_price/100)*100-svc.current_price END,completed_time);
        UPDATE barbers b SET services_done=b.services_done+1,revenue=b.revenue+svc.current_price WHERE b.id=barber_id;
      END LOOP;
    END LOOP;

    INSERT INTO barber_attendance(barber_id,attendance_date,status,clock_in,clock_out,recorded_by,updated_by,created_at,updated_at)
    SELECT b.id,today-d,CASE WHEN (b.id+d)%11=0 THEN 'absent' WHEN (b.id+d)%7=0 THEN 'late' ELSE 'present' END,
      CASE WHEN (b.id+d)%11=0 THEN NULL ELSE ((today-d)+TIME '09:00'+
        CASE WHEN (b.id+d)%7=0 THEN INTERVAL '20 minutes' ELSE INTERVAL '0 minutes' END) AT TIME ZONE 'Asia/Manila' END,
      CASE WHEN (b.id+d)%11=0 THEN NULL ELSE ((today-d)+TIME '19:30') AT TIME ZONE 'Asia/Manila' END,
      actor_id,actor_id,((today-d)+TIME '09:00') AT TIME ZONE 'Asia/Manila',((today-d)+TIME '19:30') AT TIME ZONE 'Asia/Manila'
    FROM barbers b CROSS JOIN generate_series(1,14) d WHERE b.id=ANY(barber_ids)
    ON CONFLICT DO NOTHING;
    INSERT INTO barber_attendance(barber_id,attendance_date,status,clock_in,recorded_by,updated_by)
    SELECT b.id,today,CASE WHEN b.id%3=0 THEN 'late' ELSE 'present' END,clock_timestamp(),actor_id,actor_id
    FROM barbers b WHERE b.id=ANY(barber_ids) ON CONFLICT DO NOTHING;

    -- Today's finished/cancelled appointments and a week of future reservations.
    -- Respect branch hours, shifts, breaks, reservations and time away.
    FOR day_offset IN 0..7 LOOP
      visit_date:=today+day_offset;
      FOR slot IN 0..2 LOOP
        customer_id:=customer_ids[1+(day_offset+slot)%array_length(customer_ids,1)];
        barber_id:=barber_ids[1+slot];
        SELECT * INTO STRICT svc FROM services
          WHERE id=(ARRAY['barracks-basic','signature-shave','barracks-premium'])[1+(day_offset+slot)%3] AND active;
        visit_time:=TIME '10:00'+slot*INTERVAL '120 minutes';
        occurred_at:=(visit_date+visit_time) AT TIME ZONE 'Asia/Manila';
        IF day_offset=0 AND occurred_at+svc.duration_minutes*INTERVAL '1 minute'>clock_timestamp() THEN CONTINUE; END IF;
        visit_status:=CASE WHEN day_offset>0 THEN 'confirmed' WHEN slot=2 THEN 'cancelled' ELSE 'completed' END;
        fixture_key:='demo-app-booking-' || branch_row.id || '-' || visit_date || '-' || slot;
        IF EXISTS(SELECT 1 FROM bookings b WHERE b.demo_key=fixture_key) THEN CONTINUE; END IF;
        IF EXISTS(SELECT 1 FROM bookings b WHERE b.status IN ('confirmed','checked_in','in_progress')
          AND (b.barber_id=barber_id OR b.customer_id=customer_id) AND b.booking_date=visit_date
          AND tsrange(b.booking_date+b.booking_time,CASE WHEN b.service_duration_minutes IS NULL
            THEN b.booking_date::timestamp+INTERVAL '1 day'
            ELSE b.booking_date+b.booking_time+b.service_duration_minutes*INTERVAL '1 minute' END,'[)')
          && tsrange(visit_date+visit_time,visit_date+visit_time+svc.duration_minutes*INTERVAL '1 minute','[)'))
          OR NOT EXISTS(SELECT 1 FROM barber_schedules bs JOIN shop_operating_hours h
            ON h.branch_id=branch_row.id AND h.day_of_week=bs.day_of_week
            WHERE bs.barber_id=barber_id AND bs.day_of_week=extract(dow FROM visit_date)
              AND bs.is_working AND NOT h.is_closed AND visit_time>=greatest(bs.start_time,h.open_time)
              AND visit_time+svc.duration_minutes*INTERVAL '1 minute'<=least(bs.end_time,h.close_time))
          OR EXISTS(SELECT 1 FROM barber_schedules bs JOIN barber_schedule_breaks br ON br.barber_schedule_id=bs.id
            WHERE bs.barber_id=barber_id AND bs.day_of_week=extract(dow FROM visit_date)
              AND visit_time<br.end_time AND visit_time+svc.duration_minutes*INTERVAL '1 minute'>br.start_time)
          OR EXISTS(SELECT 1 FROM barber_unavailability bu WHERE bu.barber_id=barber_id
            AND bu.starts_at<occurred_at+svc.duration_minutes*INTERVAL '1 minute' AND bu.ends_at>occurred_at)
          OR EXISTS(SELECT 1 FROM barbers b WHERE b.id=barber_id AND b.status='unavailable') THEN CONTINUE; END IF;
        INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,
          booking_date,booking_time,end_time,status,demo_key,notes,branch_id)
        VALUES(customer_id,barber_id,svc.id,svc.name,svc.current_price,svc.duration_minutes,visit_date,visit_time,
          visit_time+svc.duration_minutes*INTERVAL '1 minute',visit_status,fixture_key,
          'DEMO ONLY: seeded appointment for a branch walkthrough.',branch_row.id);
      END LOOP;
    END LOOP;

    -- Fresh daily queues, never taking over an already occupied barber/customer.
    FOR slot IN 0..4 LOOP
      customer_id:=customer_ids[slot+1];
      fixture_key:='demo-app-queue-' || branch_row.id || '-' || today || '-' || slot;
      IF EXISTS(SELECT 1 FROM queue_entries q WHERE q.idempotency_key=md5(fixture_key)::uuid
        OR (q.customer_id=customer_id AND q.status IN ('waiting','ready','in_progress'))) THEN CONTINUE; END IF;
      barber_id:=CASE WHEN slot=4 THEN barber_ids[3] WHEN slot IN (0,1) THEN barber_ids[1+slot] END;
      queue_status:=CASE slot WHEN 0 THEN 'in_progress' WHEN 1 THEN 'ready' WHEN 4 THEN 'completed' ELSE 'waiting' END;
      IF queue_status IN ('in_progress','ready') AND (
        EXISTS(SELECT 1 FROM queue_entries q WHERE q.barber_id=barber_id AND q.status IN ('ready','in_progress'))
        OR EXISTS(SELECT 1 FROM bookings b WHERE b.barber_id=barber_id AND b.status='in_progress')
        OR EXISTS(SELECT 1 FROM barbers b WHERE b.id=barber_id AND b.status='unavailable')
        OR NOT EXISTS(SELECT 1 FROM barber_attendance a WHERE a.barber_id=barber_id AND a.attendance_date=today
          AND a.status IN ('present','late') AND a.clock_in IS NOT NULL AND a.clock_out IS NULL)
      ) THEN queue_status:='waiting'; barber_id:=NULL; END IF;
      INSERT INTO queue_entries(customer_id,barber_id,service_id,status,joined_at,started_at,completed_at,
        branch_id,idempotency_key,idempotency_fingerprint)
      VALUES(customer_id,barber_id,'barracks-basic',queue_status,clock_timestamp()-INTERVAL '30 minutes',
        CASE WHEN queue_status IN ('in_progress','completed') THEN clock_timestamp()-INTERVAL '20 minutes' END,
        CASE WHEN queue_status='completed' THEN clock_timestamp()-INTERVAL '2 minutes' END,
        branch_row.id,md5(fixture_key)::uuid,fixture_key);
      IF queue_status='in_progress' THEN UPDATE barbers b SET status='busy',updated_at=NOW() WHERE b.id=barber_id; END IF;
    END LOOP;
  END LOOP;
END $$;
