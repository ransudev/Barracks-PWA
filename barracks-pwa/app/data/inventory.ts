import type { InventoryItem } from "@/app/types/domain";
import { landingProducts } from "@/app/data/landing";

function firstListedPrice(amount: string): number {
  const value = amount.match(/[\d,]+/)?.[0] ?? "0";
  return Number(value.replaceAll(",", ""));
}

export const inventory: InventoryItem[] = landingProducts.map((product, index) => ({
  id: product.id,
  name: product.name,
  category: "Products",
  current: index === 0 ? 7 : 24,
  minimum: index === 0 ? 10 : 8,
  maximum: 40,
  unitCost: firstListedPrice(product.prices[0]?.amount ?? "0"),
}));
