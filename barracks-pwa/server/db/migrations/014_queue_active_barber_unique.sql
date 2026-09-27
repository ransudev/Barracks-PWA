-- Existing duplicates must be reconciled by staff; never silently close service.
DO $$
DECLARE conflicting_ids TEXT;
BEGIN
  SELECT string_agg(format('%s/%s', first_id, second_id), ', ' ORDER BY first_id, second_id)
  INTO conflicting_ids FROM (
    SELECT a.id AS first_id, b.id AS second_id FROM queue_entries a JOIN queue_entries b
      ON a.id < b.id AND a.barber_id=b.barber_id
     AND a.status='in_progress' AND b.status='in_progress'
    ORDER BY a.id,b.id LIMIT 20
  ) conflicts;
  IF conflicting_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 014 blocked by simultaneous active queue entries (ID pairs): %', conflicting_ids;
  END IF;
END $$;

CREATE UNIQUE INDEX queue_entries_one_active_service_per_barber
  ON queue_entries(barber_id) WHERE status='in_progress';
