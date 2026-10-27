-- Additive showcase refresh for an already seeded demo database (migrations 001-021).
-- Run via db:refresh-demo. For SQL editor use, wrap this and working-demo.sql in BEGIN/COMMIT.
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(20261003, 1);

DO $$
DECLARE
  actor_id INTEGER;
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date;
  branch_row RECORD;
  source_row RECORD;
  item_id INTEGER;
  request_id BIGINT;
  branch_sku TEXT;
  target_branch_id INTEGER;
BEGIN
  SELECT u.id INTO actor_id FROM users u JOIN roles r ON r.id=u.role_id
  WHERE r.name='administrator' AND u.deleted_at IS NULL AND NOT u.is_blocked
  ORDER BY u.id LIMIT 1;
  IF actor_id IS NULL THEN RAISE EXCEPTION 'An active administrator is required'; END IF;
  IF (SELECT count(*) FROM inventory_items WHERE sku IN ('NS-DIS-001','BRX-001') AND status='active' AND supplier_id IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Seeded disinfectant and pomade inventory with linked suppliers is required';
  END IF;

  -- Separate branch stock, using the public site's four actual branch names.
  -- Existing Main Branch inventory, receiving history, and requests stay intact.
  FOR branch_row IN SELECT * FROM (VALUES
    ('bajada','Barracks Bajada HQ',9,'Pending'),
    ('lanang','Barracks Lanang HQ',0,'Preparing'),
    ('bangkal','Barracks Bangkal HQ',18,'Shipped'),
    ('maa','Barracks Maa HQ',6,'Delivered')
  ) AS branches(key,name,stock,request_status) LOOP
    target_branch_id := NULL;
    IF to_regclass('branches') IS NOT NULL THEN
      SELECT id INTO STRICT target_branch_id FROM branches WHERE name=branch_row.name AND status='active';
    END IF;
    FOR source_row IN SELECT * FROM inventory_items WHERE sku IN ('NS-DIS-001','BRX-001') LOOP
      branch_sku := 'DEMO-' || upper(branch_row.key) || '-' || source_row.sku;
      IF NOT EXISTS (SELECT 1 FROM inventory_items WHERE lower(sku)=lower(branch_sku) AND branch=branch_row.name) THEN
        IF target_branch_id IS NOT NULL THEN
          INSERT INTO inventory_items(name,category,quantity,minimum_stock,maximum_stock,unit_cost,unit,sku,status,supplier_id,image_url,branch,branch_id)
          VALUES(source_row.name,source_row.category,branch_row.stock,source_row.minimum_stock,source_row.maximum_stock,
            source_row.unit_cost,source_row.unit,branch_sku,'active',source_row.supplier_id,source_row.image_url,branch_row.name,target_branch_id);
        ELSE
          INSERT INTO inventory_items(name,category,quantity,minimum_stock,maximum_stock,unit_cost,unit,sku,status,supplier_id,image_url,branch)
          VALUES(source_row.name,source_row.category,branch_row.stock,source_row.minimum_stock,source_row.maximum_stock,
            source_row.unit_cost,source_row.unit,branch_sku,'active',source_row.supplier_id,source_row.image_url,branch_row.name);
        END IF;
      END IF;
      SELECT id INTO STRICT item_id FROM inventory_items WHERE lower(sku)=lower(branch_sku) AND branch=branch_row.name;

      -- One request per supplier/branch, with a stable reference across reruns.
      SELECT id INTO request_id FROM restock_requests
      WHERE reference=branch_sku || '-RESTOCK' ORDER BY id LIMIT 1;
      IF request_id IS NULL THEN
        IF target_branch_id IS NOT NULL THEN
          INSERT INTO restock_requests(supplier_id,branch,branch_id,status,reference,notes,requested_by)
          VALUES(source_row.supplier_id,branch_row.name,target_branch_id,branch_row.request_status,branch_sku || '-RESTOCK',
            'Demo branch stock replenishment; receiving remains a staff action.',actor_id)
          RETURNING id INTO request_id;
        ELSE
          INSERT INTO restock_requests(supplier_id,branch,status,reference,notes,requested_by)
          VALUES(source_row.supplier_id,branch_row.name,branch_row.request_status,branch_sku || '-RESTOCK',
            'Demo branch stock replenishment; receiving remains a staff action.',actor_id)
          RETURNING id INTO request_id;
        END IF;
        INSERT INTO restock_request_items(restock_request_id,inventory_item_id,requested_quantity,unit_cost)
        VALUES(request_id,item_id,18,source_row.unit_cost);
      END IF;
    END LOOP;
  END LOOP;

  -- Move only untouched, overdue demo confirmations; keep completed/paid visits.
  UPDATE bookings b SET booking_date=today + CASE b.demo_key WHEN 'demo-ana-basic' THEN 1 ELSE 2 END,
    updated_at=NOW()
  FROM customers c JOIN users u ON u.id=c.user_id
  WHERE b.customer_id=c.id AND b.status='confirmed' AND b.booking_date<today
    AND ((b.demo_key='demo-ana-basic' AND u.email='demo.customer.ana@barracks.app')
      OR (b.demo_key='demo-paulo-shave' AND u.email='demo.customer.paulo@barracks.app'))
    AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.booking_id=b.id)
    AND NOT EXISTS (SELECT 1 FROM queue_entries q WHERE q.booking_id=b.id);

  -- Present/late/absent examples for the existing demo roster. Existing daily
  -- attendance and corrections are never changed; clock-ins cannot be in the future.
  INSERT INTO barber_attendance(barber_id,attendance_date,status,clock_in,recorded_by,updated_by)
  SELECT b.id,today,d.status,
    CASE WHEN d.status='absent' THEN NULL ELSE CURRENT_TIMESTAMP END,actor_id,actor_id
  FROM barbers b JOIN (VALUES
    ('Miko','Reyes','present'),('Paolo','Santos','late'),
    ('Andrei','Villanueva','present'),('Luis','Dela Cruz','absent')
  ) d(first_name,last_name,status) ON b.first_name=d.first_name AND b.last_name=d.last_name
  ON CONFLICT(barber_id,attendance_date) DO NOTHING;

  -- The old seed marked Paolo busy without an active service.
  UPDATE barbers b SET status='available',updated_at=NOW()
  WHERE first_name='Paolo' AND last_name='Santos' AND status='busy'
    AND NOT EXISTS (SELECT 1 FROM queue_entries q WHERE q.barber_id=b.id AND q.status IN ('ready','in_progress'))
    AND NOT EXISTS (SELECT 1 FROM bookings bk WHERE bk.barber_id=b.id AND bk.status='in_progress');

  -- A waiting walk-in example for the demo customer, at most once per Manila day.
  INSERT INTO queue_entries(customer_id,service_id,status)
  SELECT c.id,s.id,'waiting' FROM customers c JOIN users u ON u.id=c.user_id
  JOIN services s ON s.id='barracks-basic' AND s.active
  WHERE u.email='demo.customer.ana@barracks.app' AND u.deleted_at IS NULL AND NOT u.is_blocked
    AND NOT EXISTS (SELECT 1 FROM queue_entries q WHERE q.customer_id=c.id
      AND (q.status IN ('waiting','ready','in_progress') OR (q.joined_at AT TIME ZONE 'Asia/Manila')::date=today));
END;
$$;
