import type { Pool, PoolClient } from "pg";

type Queryable = Pool | PoolClient;

export type LowStockAlert = {
  id: number;
  itemId: number;
  itemName: string;
  branch: string;
  currentQuantity: number;
  threshold: number;
  unit: string;
};

/**
 * An acknowledgement is valid only for the current low-stock cycle. Mark it
 * resolved as soon as stock crosses above the current threshold so a later
 * drop creates a visible alert again, even if no page was open in between.
 */
export async function resolveLowStockAcknowledgements(
  db: Queryable,
  inventoryItemId: number,
  quantity: number,
): Promise<void> {
  await db.query(
    `UPDATE inventory_alert_acknowledgements a
     SET resolved_at = COALESCE(a.resolved_at, NOW())
     FROM inventory_items i
     WHERE a.inventory_item_id = i.id
       AND a.inventory_item_id = $1
       AND a.resolved_at IS NULL
       AND $2 > i.minimum_stock`,
    [inventoryItemId, quantity],
  );
}

export async function listLowStockAlerts(db: Pool, userId: number): Promise<LowStockAlert[]> {
  await db.query(
    `UPDATE inventory_alert_acknowledgements a
     SET resolved_at = COALESCE(a.resolved_at, NOW())
     FROM inventory_items i
     WHERE a.inventory_item_id = i.id
       AND a.acknowledged_by = $1
       AND a.resolved_at IS NULL
       AND i.quantity > i.minimum_stock`,
    [userId],
  );
  const result = await db.query<{
    id: number;
    item_id: number;
    item_name: string;
    branch: string;
    quantity: number;
    minimum_stock: number;
    unit: string;
  }>(
    `SELECT i.id, i.id AS item_id, i.name AS item_name, i.branch,
            i.quantity, i.minimum_stock, i.unit
     FROM inventory_items i
     LEFT JOIN inventory_alert_acknowledgements a
       ON a.inventory_item_id = i.id
      AND a.acknowledged_by = $1
      AND a.resolved_at IS NULL
     WHERE i.status = 'active'
       AND i.quantity <= i.minimum_stock
       AND a.id IS NULL
     ORDER BY i.quantity ASC, i.name ASC, i.id ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    itemId: Number(row.item_id),
    itemName: row.item_name,
    branch: row.branch,
    currentQuantity: Number(row.quantity),
    threshold: Number(row.minimum_stock),
    unit: row.unit,
  }));
}

export async function acknowledgeLowStockAlert(
  db: Pool,
  inventoryItemId: number,
  userId: number,
): Promise<LowStockAlert> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const item = await client.query<{
      id: number;
      name: string;
      branch: string;
      quantity: number;
      minimum_stock: number;
      unit: string;
      status: "active" | "inactive";
    }>(
      `SELECT id, name, branch, quantity, minimum_stock, unit, status
       FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [inventoryItemId],
    );
    const row = item.rows[0];
    if (!row || row.status !== "active") throw new Error("INVENTORY_NOT_FOUND");
    if (Number(row.quantity) > Number(row.minimum_stock)) throw new Error("ALERT_NOT_ACTIVE");

    await client.query(
      `INSERT INTO inventory_alert_acknowledgements
         (inventory_item_id, branch, acknowledged_by, acknowledged_quantity, acknowledged_at, resolved_at)
       VALUES ($1, $2, $3, $4, NOW(), NULL)
       ON CONFLICT (inventory_item_id, acknowledged_by)
       DO UPDATE SET branch = EXCLUDED.branch,
                     acknowledged_quantity = EXCLUDED.acknowledged_quantity,
                     acknowledged_at = NOW(),
                     resolved_at = NULL`,
      [inventoryItemId, row.branch, userId, row.quantity],
    );
    await client.query("COMMIT");
    return {
      id: Number(row.id),
      itemId: Number(row.id),
      itemName: row.name,
      branch: row.branch,
      currentQuantity: Number(row.quantity),
      threshold: Number(row.minimum_stock),
      unit: row.unit,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
