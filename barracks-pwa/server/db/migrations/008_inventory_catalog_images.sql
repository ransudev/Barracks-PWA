-- Shared, unbranded category photography for the demo inventory catalog.
-- Only fill empty image slots so manually uploaded item photos remain intact.
UPDATE inventory_items
SET image_url = CASE LOWER(BTRIM(name))
  WHEN 'neck strips' THEN '/inventory/neck-strips.webp'
  WHEN 'disinfectant spray' THEN '/inventory/disinfectant-spray.webp'
  WHEN 'barber capes' THEN '/inventory/barber-cape.webp'
  WHEN 'cordless clippers' THEN '/inventory/cordless-clippers.webp'
  WHEN 'hot towel steamer' THEN '/inventory/hot-towel-steamer.webp'
  WHEN 'amore pomade' THEN '/inventory/styling-pomade.webp'
  WHEN 'bravo hair tonic' THEN '/inventory/hair-serum.webp'
  WHEN 'chief sea salt' THEN '/inventory/styling-pomade.webp'
  WHEN 'delta styling powder' THEN '/inventory/styling-powder.webp'
  WHEN 'elite cream pomade' THEN '/inventory/styling-pomade.webp'
  WHEN 'frost massage gel' THEN '/inventory/massage-gel.webp'
  WHEN 'generals'' grooming kit' THEN '/inventory/grooming-kit.webp'
  WHEN 'gift vouchers' THEN '/inventory/gift-vouchers.webp'
  WHEN 'barracks wooden comb' THEN '/inventory/wooden-comb.webp'
  WHEN 'barracks car decals' THEN '/inventory/car-decals.webp'
  WHEN 'strong pomade' THEN '/inventory/styling-pomade.webp'
  WHEN 'beach clay' THEN '/inventory/styling-pomade.webp'
  WHEN 'barber wax' THEN '/inventory/styling-pomade.webp'
  WHEN 'slick pomade red' THEN '/inventory/styling-pomade.webp'
  WHEN 'slick pomade blue' THEN '/inventory/styling-pomade.webp'
  WHEN 'anti-dandruff serum' THEN '/inventory/hair-serum.webp'
  WHEN 'scalp hydrate' THEN '/inventory/hair-serum.webp'
  WHEN 'arm mask' THEN '/inventory/treatment-mask.webp'
  WHEN 'serioxyl spray' THEN '/inventory/hair-spray.webp'
  WHEN 'serioxyl shampoo' THEN '/inventory/shampoo-bottle.webp'
  WHEN 'aminexil serum' THEN '/inventory/hair-serum.webp'
  ELSE image_url
END,
updated_at = NOW()
WHERE image_url IS NULL
  AND LOWER(BTRIM(name)) IN (
    'neck strips',
    'disinfectant spray',
    'barber capes',
    'cordless clippers',
    'hot towel steamer',
    'amore pomade',
    'bravo hair tonic',
    'chief sea salt',
    'delta styling powder',
    'elite cream pomade',
    'frost massage gel',
    'generals'' grooming kit',
    'gift vouchers',
    'barracks wooden comb',
    'barracks car decals',
    'strong pomade',
    'beach clay',
    'barber wax',
    'slick pomade red',
    'slick pomade blue',
    'anti-dandruff serum',
    'scalp hydrate',
    'arm mask',
    'serioxyl spray',
    'serioxyl shampoo',
    'aminexil serum'
  );
