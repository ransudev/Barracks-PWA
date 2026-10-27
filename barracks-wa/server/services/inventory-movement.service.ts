import type { Pool, PoolClient } from "pg";
import { inTransaction } from "@/server/db/transaction";
import type { InventoryMovementInput } from "@/server/schemas/sprint2.schema";
import { resolveLowStockAcknowledgements } from "@/server/services/inventory-alert.service";

type Queryable = Pool | PoolClient;

function deltaFor(input: InventoryMovementInput): number {
  if (input.movementType === "RECEIVE" || input.movementType === "RETURN") return input.quantity;
  if (["USE", "CUSTOMER_PURCHASE", "STAFF_USAGE", "DAMAGE", "DISCARD"].includes(input.movementType)) {
    return -input.quantity;
  }
  return input.adjustmentDirection === "increase" ? input.quantity : -input.quantity;
}

export async function applyInventoryMovement(
  db: Pool | PoolClient,
  inventoryItemId: number,
  userId: number,
  input: InventoryMovementInput,
) {
  return inTransaction(db, async (client) => {
    const itemResult = await client.query<{
      quantity: number;
      supplier_id: number | null;
      unit_cost: number | string;
      category: "Supplies" | "Equipment" | "Products";
      branch: string;
    }>(
      "SELECT quantity, supplier_id, unit_cost, category, branch FROM inventory_items WHERE id=$1 AND status='active' FOR UPDATE",
      [inventoryItemId],
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error("INVENTORY_NOT_FOUND");

    if (input.movementType === "CUSTOMER_PURCHASE" && !["Products", "Supplies"].includes(item.category)) {
      throw new Error("CUSTOMER_PURCHASE_REQUIRES_PRODUCT");
    }
    if (input.movementType === "STAFF_USAGE" && !["Products", "Supplies"].includes(item.category)) {
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
    await resolveLowStockAcknowledgements(client, inventoryItemId, newStock);
    const movement = await client.query(
      `INSERT INTO inventory_movements
        (inventory_item_id,supplier_id,branch,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id,inventory_item_id,supplier_id,branch,branch_id,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by,created_at`,
      [inventoryItemId, supplierId, item.branch, input.movementType, input.quantity, previousStock, newStock, unitCost,
        input.reference ?? null, input.notes, userId],
    );
    return movement.rows[0];
  });
}

export async function listInventoryMovements(db: Queryable, inventoryItemId?: number, branchId?: number) {
  if (inventoryItemId) {
    return (await db.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name AS created_by_name, s.company_name AS supplier_name
       FROM inventory_movements m
       JOIN inventory_items i ON i.id=m.inventory_item_id
       JOIN users u ON u.id=m.created_by
       LEFT JOIN suppliers s ON s.id=m.supplier_id
       WHERE m.inventory_item_id=$1 AND ($2::integer IS NULL OR m.branch_id=$2) ORDER BY m.created_at DESC`, [inventoryItemId, branchId ?? null])).rows;
  }
  return (await db.query(
    `SELECT m.*, i.name AS item_name, u.first_name || ' ' || u.last_name AS created_by_name, s.company_name AS supplier_name
     FROM inventory_movements m
     JOIN inventory_items i ON i.id=m.inventory_item_id
     JOIN users u ON u.id=m.created_by
     LEFT JOIN suppliers s ON s.id=m.supplier_id
     ORDER BY m.created_at DESC LIMIT 500`)).rows;
}
