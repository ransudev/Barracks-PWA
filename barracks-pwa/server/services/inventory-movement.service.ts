import type { Pool, PoolClient } from "pg";
import type { InventoryMovementInput } from "@/server/schemas/sprint2.schema";

type Queryable = Pool | PoolClient;

function deltaFor(input: InventoryMovementInput): number {
  if (input.movementType === "RECEIVE" || input.movementType === "RETURN") return input.quantity;
  if (["USE", "CUSTOMER_PURCHASE", "STAFF_USAGE", "DAMAGE", "DISCARD"].includes(input.movementType)) {
    return -input.quantity;
  }
  return input.adjustmentDirection === "increase" ? input.quantity : -input.quantity;
}

export async function applyInventoryMovement(
  db: Pool,
  inventoryItemId: number,
  userId: number,
  input: InventoryMovementInput,
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const itemResult = await client.query<{
      quantity: number;
      supplier_id: number | null;
      unit_cost: number | string;
      category: "Supplies" | "Equipment" | "Products";
    }>(
      "SELECT quantity, supplier_id, unit_cost, category FROM inventory_items WHERE id=$1 AND status='active' FOR UPDATE",
      [inventoryItemId],
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error("INVENTORY_NOT_FOUND");

    if (input.movementType === "CUSTOMER_PURCHASE" && item.category !== "Products") {
      throw new Error("CUSTOMER_PURCHASE_REQUIRES_PRODUCT");
    }
    if (input.movementType === "STAFF_USAGE" && item.category !== "Supplies") {
      throw new Error("STAFF_USAGE_REQUIRES_SUPPLY");
    }

    const previousStock = Number(item.quantity);
    const newStock = previousStock + deltaFor(input);
    if (newStock < 0) throw new Error("NEGATIVE_STOCK");

    const supplierId = input.supplierId ?? item.supplier_id ?? null;
    const unitCost = input.unitCost ?? Number(item.unit_cost);

    await client.query(
      "UPDATE inventory_items SET quantity=$1, unit_cost=COALESCE($2, unit_cost), updated_at=NOW() WHERE id=$3",
      [newStock, input.movementType === "RECEIVE" ? unitCost : null, inventoryItemId],
    );
    const movement = await client.query(
      `INSERT INTO inventory_movements
        (inventory_item_id,supplier_id,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,inventory_item_id,supplier_id,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by,created_at`,
      [inventoryItemId, supplierId, input.movementType, input.quantity, previousStock, newStock, unitCost,
        input.reference ?? null, input.notes, userId],
    );
    await client.query("COMMIT");
    return movement.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listInventoryMovements(db: Queryable, inventoryItemId?: number) {
  if (inventoryItemId) {
    return (await db.query(
      `SELECT m.*, i.branch, u.first_name || ' ' || u.last_name AS created_by_name, s.company_name AS supplier_name
       FROM inventory_movements m
       JOIN inventory_items i ON i.id=m.inventory_item_id
       JOIN users u ON u.id=m.created_by
       LEFT JOIN suppliers s ON s.id=m.supplier_id
       WHERE m.inventory_item_id=$1 ORDER BY m.created_at DESC`, [inventoryItemId])).rows;
  }
  return (await db.query(
    `SELECT m.*, i.name AS item_name, i.branch, u.first_name || ' ' || u.last_name AS created_by_name, s.company_name AS supplier_name
     FROM inventory_movements m
     JOIN inventory_items i ON i.id=m.inventory_item_id
     JOIN users u ON u.id=m.created_by
     LEFT JOIN suppliers s ON s.id=m.supplier_id
     ORDER BY m.created_at DESC LIMIT 500`)).rows;
}
