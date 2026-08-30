import type { Pool } from "pg";
import type { InventoryItemInput } from "@/server/schemas/sprint.schema";

type InventoryRow = {
  id: number;
  name: string;
  category: "Supplies" | "Equipment" | "Products";
  quantity: number;
  minimum_stock: number;
  unit_cost: number | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryRecord = {
  id: number;
  name: string;
  category: InventoryRow["category"];
  quantity: number;
  minimumStock: number;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
};

const inventorySelect = `
  SELECT id, name, category, quantity, minimum_stock, unit_cost, created_at, updated_at
  FROM inventory_items
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toInventory(row: InventoryRow): InventoryRecord {
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    minimumStock: Number(row.minimum_stock),
    unitCost: Number(row.unit_cost),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listInventory(db: Pool): Promise<InventoryRecord[]> {
  const result = await db.query<InventoryRow>(`${inventorySelect} ORDER BY name ASC, id ASC`);
  return result.rows.map(toInventory);
}

export async function findInventoryById(db: Pool, id: number): Promise<InventoryRecord | null> {
  const result = await db.query<InventoryRow>(`${inventorySelect} WHERE id = $1`, [id]);
  return result.rows[0] ? toInventory(result.rows[0]) : null;
}

export async function createInventory(
  db: Pool,
  input: InventoryItemInput,
): Promise<InventoryRecord> {
  const result = await db.query<{ id: number }>(
    `
      INSERT INTO inventory_items (name, category, quantity, minimum_stock, unit_cost)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.name, input.category, input.quantity, input.minimumStock, input.unitCost],
  );
  return (await findInventoryById(db, result.rows[0].id)) as InventoryRecord;
}

export async function updateInventory(
  db: Pool,
  id: number,
  input: InventoryItemInput,
): Promise<InventoryRecord | null> {
  const result = await db.query<{ id: number }>(
    `
      UPDATE inventory_items
      SET name = $1, category = $2, quantity = $3, minimum_stock = $4,
          unit_cost = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING id
    `,
    [input.name, input.category, input.quantity, input.minimumStock, input.unitCost, id],
  );
  return result.rows[0] ? findInventoryById(db, id) : null;
}

export async function deleteInventory(db: Pool, id: number): Promise<boolean> {
  const result = await db.query("DELETE FROM inventory_items WHERE id = $1", [id]);
  return Boolean(result.rowCount);
}
