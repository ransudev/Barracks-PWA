import type { Pool } from "pg";
import type { InventoryItemInput } from "@/server/schemas/sprint.schema";
import type { z } from "zod";
import type { inventoryMetadataSchema } from "@/server/schemas/sprint2.schema";

type InventoryMetadataInput = z.infer<typeof inventoryMetadataSchema>;

type InventoryRow = {
  id: number;
  name: string;
  category: "Supplies" | "Equipment" | "Products";
  quantity: number;
  minimum_stock: number;
  maximum_stock: number | null;
  unit_cost: number | string;
  unit: string;
  sku: string | null;
  status: "active" | "inactive";
  supplier_id: number | null;
  supplier_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryRecord = {
  id: number;
  name: string;
  category: InventoryRow["category"];
  quantity: number;
  minimumStock: number;
  maximumStock: number | null;
  unitCost: number;
  unit: string;
  sku: string | null;
  status: "active" | "inactive";
  supplierId: number | null;
  supplierName: string | null;
  createdAt: string;
  updatedAt: string;
};

const inventorySelect = `
  SELECT i.id, i.name, i.category, i.quantity, i.minimum_stock, i.maximum_stock, i.unit_cost,
         i.unit, i.sku, i.status, i.supplier_id, s.company_name AS supplier_name,
         i.created_at, i.updated_at
  FROM inventory_items i
  LEFT JOIN suppliers s ON s.id=i.supplier_id
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toInventory(row: InventoryRow): InventoryRecord {
  return {
    id: Number(row.id), name: row.name, category: row.category, quantity: Number(row.quantity),
    minimumStock: Number(row.minimum_stock), maximumStock: row.maximum_stock === null ? null : Number(row.maximum_stock),
    unitCost: Number(row.unit_cost), unit: row.unit, sku: row.sku, status: row.status,
    supplierId: row.supplier_id === null ? null : Number(row.supplier_id), supplierName: row.supplier_name,
    createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
  };
}

export async function listInventory(db: Pool): Promise<InventoryRecord[]> {
  const result = await db.query<InventoryRow>(`${inventorySelect} ORDER BY i.name ASC, i.id ASC`);
  return result.rows.map(toInventory);
}

export async function findInventoryById(db: Pool, id: number): Promise<InventoryRecord | null> {
  const result = await db.query<InventoryRow>(`${inventorySelect} WHERE i.id = $1`, [id]);
  return result.rows[0] ? toInventory(result.rows[0]) : null;
}

export async function createInventory(db: Pool, input: InventoryItemInput): Promise<InventoryRecord> {
  const result = await db.query<{ id: number }>(`
    INSERT INTO inventory_items (name, category, quantity, minimum_stock, unit_cost)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.name, input.category, input.quantity, input.minimumStock, input.unitCost]);
  return (await findInventoryById(db, result.rows[0].id)) as InventoryRecord;
}

// Legacy Sprint 1 editor. Quantity is deliberately no longer changed here.
// Stock mutations must go through inventory movements so every change is auditable.
export async function updateInventory(db: Pool, id: number, input: InventoryItemInput): Promise<InventoryRecord | null> {
  const result = await db.query<{ id: number }>(`
    UPDATE inventory_items SET name=$1, category=$2, minimum_stock=$3, unit_cost=$4, updated_at=NOW()
    WHERE id=$5 RETURNING id`,
    [input.name, input.category, input.minimumStock, input.unitCost, id]);
  return result.rows[0] ? findInventoryById(db, id) : null;
}

export async function updateInventoryMetadata(db: Pool, id: number, input: InventoryMetadataInput): Promise<InventoryRecord | null> {
  const result = await db.query<{ id: number }>(`
    UPDATE inventory_items SET name=$1,category=$2,supplier_id=$3,unit=$4,sku=$5,minimum_stock=$6,
      maximum_stock=$7,unit_cost=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING id`,
    [input.name,input.category,input.supplierId,input.unit,input.sku,input.minimumStock,input.maximumStock,input.unitCost,input.status,id]);
  return result.rows[0] ? findInventoryById(db, id) : null;
}

export async function deleteInventory(db: Pool, id: number): Promise<boolean> {
  const history = await db.query("SELECT 1 FROM inventory_movements WHERE inventory_item_id=$1 LIMIT 1", [id]);
  if (history.rows[0]) {
    const result = await db.query("UPDATE inventory_items SET status='inactive',updated_at=NOW() WHERE id=$1", [id]);
    return Boolean(result.rowCount);
  }
  const result = await db.query("DELETE FROM inventory_items WHERE id=$1", [id]);
  return Boolean(result.rowCount);
}
