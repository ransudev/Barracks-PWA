-- Product photos let the shop-floor catalog identify an item at a glance. The
-- column holds either an image link or the down-scaled data URL produced by the
-- item form, so no separate upload service is required.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS image_url TEXT;
