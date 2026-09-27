-- Fail migration if old rows violate lifecycle state instead of silently rewriting history.
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_lifecycle_state CHECK (
  (status = 'waiting' AND barber_id IS NULL AND started_at IS NULL AND completed_at IS NULL)
  OR (status = 'ready' AND barber_id IS NOT NULL AND started_at IS NULL AND completed_at IS NULL)
  OR (status = 'in_progress' AND barber_id IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL)
  OR (status = 'completed' AND barber_id IS NOT NULL AND started_at IS NOT NULL
      AND completed_at IS NOT NULL AND completed_at >= started_at)
  OR (status = 'removed' AND started_at IS NULL AND completed_at IS NULL)
);
