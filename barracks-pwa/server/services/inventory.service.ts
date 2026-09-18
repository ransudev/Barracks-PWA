import type { Pool, PoolClient } from "pg";
import type { InventoryItemInput } from "@/server/schemas/sprint.schema";
import type { InventoryCreateInput, InventoryMetadataInput } from "@/server/schemas/sprint2.schema";

type Queryable = Pool | PoolClient;

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
  branch: string;
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
  branch: string;
  createdAt: string;
  updatedAt: string;
};

const inventorySelect = `
  SELECT i.id, i.name, i.category, i.quantity, i.minimum_stock, i.maximum_stock, i.unit_cost,
         i.unit, i.sku, i.status, i.supplier_id, s.company_name AS supplier_name, i.branch,
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
    branch: row.branch,
    createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
  };
}

async function assertActiveSupplier(db: Queryable, supplierId: number | null): Promise<void> {
  if (supplierId === null) return;
  const supplier = await db.query("SELECT id FROM suppliers WHERE id=$1 AND status='active'", [supplierId]);
  if (!supplier.rows[0]) throw new Error("SUPPLIER_UNAVAILABLE");
}

export async function listInventory(db: Pool, branch?: string): Promise<InventoryRecord[]> {
  const params = branch ? [branch] : [];
  const result = await db.query<InventoryRow>(
    `${inventorySelect} ${branch ? "WHERE i.branch = $1" : ""} ORDER BY i.name ASC, i.id ASC`,
    params,
  );
  return result.rows.map(toInventory);
}

export async function findInventoryById(db: Pool, id: number): Promise<InventoryRecord | null> {
  const result = await db.query<InventoryRow>(`${inventorySelect} WHERE i.id = $1`, [id]);
  return result.rows[0] ? toInventory(result.rows[0]) : null;
}

// Kept for compatibility with older seed/tests. New UI/API uses createInventoryItem.
export async function createInventory(db: Pool, input: InventoryItemInput): Promise<InventoryRecord> {
  const result = await db.query<{ id: number }>(`
    INSERT INTO inventory_items (name, category, branch, quantity, minimum_stock, unit_cost)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.name, input.category, input.branch, input.quantity, input.minimumStock, input.unitCost]);
  return (await findInventoryById(db, result.rows[0].id)) as InventoryRecord;
}

export async function createInventoryItem(db: Pool, input: InventoryCreateInput): Promise<InventoryRecord> {
  await assertActiveSupplier(db, input.supplierId);
  const result = await db.query<{ id: number }>(`
    INSERT INTO inventory_items
      (name,category,branch,quantity,minimum_stock,maximum_stock,unit_cost,unit,sku,status,supplier_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [input.name,input.category,input.branch,input.initialQuantity,input.minimumStock,input.maximumStock,input.unitCost,
      input.unit,input.sku,input.status,input.supplierId]);
  return (await findInventoryById(db,result.rows[0].id))!;
}

// Legacy Sprint 1 editor. Quantity is deliberately no longer changed here.
export async function updateInventory(db: Pool, id: number, input: InventoryItemInput): Promise<InventoryRecord | null> {
  const result = await db.query<{ id: number }>(`
    UPDATE inventory_items SET name=$1, category=$2, branch=$3, minimum_stock=$4, unit_cost=$5, updated_at=NOW()
    WHERE id=$6 RETURNING id`,
    [input.name, input.category, input.branch, input.minimumStock, input.unitCost, id]);
  return result.rows[0] ? findInventoryById(db, id) : null;
}

export async function updateInventoryMetadata(
  db: Pool,
  id: number,
  userId: number,
  input: InventoryMetadataInput,
): Promise<InventoryRecord | null> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      minimum_stock: number;
      maximum_stock: number | null;
      branch: string;
    }>(
        "SELECT minimum_stock, maximum_stock, branch FROM inventory_items WHERE id=$1 FOR UPDATE",
      [id],
    );
    const existing = current.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return null;
    }

    const previousMinimum = Number(existing.minimum_stock);
    const previousMaximum = existing.maximum_stock === null ? null : Number(existing.maximum_stock);
    await assertActiveSupplier(client, input.supplierId);
    if (existing.branch !== input.branch || previousMinimum !== input.minimumStock) {
      await client.query("DELETE FROM inventory_alert_acknowledgements WHERE inventory_item_id=$1", [id]);
    }
    await client.query(`
      UPDATE inventory_items SET name=$1,category=$2,branch=$3,supplier_id=$4,unit=$5,sku=$6,minimum_stock=$7,
        maximum_stock=$8,unit_cost=$9,status=$10,updated_at=NOW() WHERE id=$11`,
      [input.name,input.category,input.branch,input.supplierId,input.unit,input.sku,input.minimumStock,input.maximumStock,input.unitCost,input.status,id]);

    if (previousMinimum !== input.minimumStock || previousMaximum !== input.maximumStock) {
      await client.query(`
        INSERT INTO inventory_threshold_history
          (inventory_item_id,branch,previous_minimum_stock,new_minimum_stock,previous_maximum_stock,new_maximum_stock,changed_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, input.branch, previousMinimum, input.minimumStock, previousMaximum, input.maximumStock, userId]);
    }

    await client.query("COMMIT");
    return findInventoryById(db, id);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listInventoryThresholdHistory(db: Pool, inventoryItemId: number) {
  const result = await db.query(
    `SELECT h.id, h.inventory_item_id, h.branch,
            h.previous_minimum_stock, h.new_minimum_stock,
            h.previous_maximum_stock, h.new_maximum_stock,
            h.changed_by, h.changed_at,
            u.first_name || ' ' || u.last_name AS changed_by_name
     FROM inventory_threshold_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.inventory_item_id = $1
     ORDER BY h.changed_at DESC, h.id DESC`,
    [inventoryItemId],
  );
  return result.rows;
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
