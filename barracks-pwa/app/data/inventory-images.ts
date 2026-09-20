/**
 * Shared catalog photography for inventory items.
 *
 * These are intentionally category-level images: visually similar SKUs reuse
 * one neutral, unbranded product photo instead of creating a separate asset
 * for every item in the catalog.
 */
export const inventoryImageByKey = {
  "neck-strips": "/inventory/neck-strips.webp",
  disinfectant: "/inventory/disinfectant-spray.webp",
  capes: "/inventory/barber-cape.webp",
  clippers: "/inventory/cordless-clippers.webp",
  steamer: "/inventory/hot-towel-steamer.webp",
  "amore-pomade": "/inventory/styling-pomade.webp",
  "bravo-hair-tonic": "/inventory/hair-serum.webp",
  "chief-sea-salt": "/inventory/styling-pomade.webp",
  "delta-styling-powder": "/inventory/styling-powder.webp",
  "elite-cream-pomade": "/inventory/styling-pomade.webp",
  "frost-massage-gel": "/inventory/massage-gel.webp",
  "generals-grooming-kit": "/inventory/grooming-kit.webp",
  "gift-vouchers": "/inventory/gift-vouchers.webp",
  "wooden-comb": "/inventory/wooden-comb.webp",
  "car-decals": "/inventory/car-decals.webp",
  "strong-pomade": "/inventory/styling-pomade.webp",
  "beach-clay": "/inventory/styling-pomade.webp",
  "barber-wax": "/inventory/styling-pomade.webp",
  "slick-pomade-red": "/inventory/styling-pomade.webp",
  "slick-pomade-blue": "/inventory/styling-pomade.webp",
  "anti-dandruff-serum": "/inventory/hair-serum.webp",
  "scalp-hydrate": "/inventory/hair-serum.webp",
  "arm-mask": "/inventory/treatment-mask.webp",
  "serioxyl-spray": "/inventory/hair-spray.webp",
  "serioxyl-shampoo": "/inventory/shampoo-bottle.webp",
  "aminexil-serum": "/inventory/hair-serum.webp",
} as const;

export type InventoryImageKey = keyof typeof inventoryImageByKey;

const inventoryImageByName: Record<string, string> = {
  "neck strips": inventoryImageByKey["neck-strips"],
  "disinfectant spray": inventoryImageByKey.disinfectant,
  "barber capes": inventoryImageByKey.capes,
  "cordless clippers": inventoryImageByKey.clippers,
  "hot towel steamer": inventoryImageByKey.steamer,
  "amore pomade": inventoryImageByKey["amore-pomade"],
  "bravo hair tonic": inventoryImageByKey["bravo-hair-tonic"],
  "chief sea salt": inventoryImageByKey["chief-sea-salt"],
  "delta styling powder": inventoryImageByKey["delta-styling-powder"],
  "elite cream pomade": inventoryImageByKey["elite-cream-pomade"],
  "frost massage gel": inventoryImageByKey["frost-massage-gel"],
  "generals' grooming kit": inventoryImageByKey["generals-grooming-kit"],
  "gift vouchers": inventoryImageByKey["gift-vouchers"],
  "barracks wooden comb": inventoryImageByKey["wooden-comb"],
  "barracks car decals": inventoryImageByKey["car-decals"],
  "strong pomade": inventoryImageByKey["strong-pomade"],
  "beach clay": inventoryImageByKey["beach-clay"],
  "barber wax": inventoryImageByKey["barber-wax"],
  "slick pomade red": inventoryImageByKey["slick-pomade-red"],
  "slick pomade blue": inventoryImageByKey["slick-pomade-blue"],
  "anti-dandruff serum": inventoryImageByKey["anti-dandruff-serum"],
  "scalp hydrate": inventoryImageByKey["scalp-hydrate"],
  "arm mask": inventoryImageByKey["arm-mask"],
  "serioxyl spray": inventoryImageByKey["serioxyl-spray"],
  "serioxyl shampoo": inventoryImageByKey["serioxyl-shampoo"],
  "aminexil serum": inventoryImageByKey["aminexil-serum"],
};

export function getInventoryImageForName(name: string): string | null {
  return inventoryImageByName[name.trim().toLowerCase()] ?? null;
}
