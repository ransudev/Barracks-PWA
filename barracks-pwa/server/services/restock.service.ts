import type { Pool } from "pg";
import type { ReceiveRestockInput, RestockCreateInput } from "@/server/schemas/sprint2.schema";
import { resolveLowStockAcknowledgements } from "@/server/services/inventory-alert.service";

const supplierTransitions: Record<string, string[]> = {
  Pending: ["Accepted", "Cancelled"],
  Accepted: ["Preparing", "Cancelled"],
  Preparing: ["Shipped", "Cancelled"],
  Shipped: [],
  Delivered: [],
};

export async function createRestockRequest(db: Pool, userId: number, input: RestockCreateInput) {
  if (new Set(input.items.map((item) => item.inventoryItemId)).size !== input.items.length) {
    throw new Error("DUPLICATE_RESTOCK_ITEM");
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const supplier = await client.query("SELECT id FROM suppliers WHERE id=$1 AND status='active'", [input.supplierId]);
    if (!supplier.rows[0]) throw new Error("SUPPLIER_UNAVAILABLE");

    const request = await client.query<{ id: number }>(
      `INSERT INTO restock_requests (supplier_id,branch,reference,notes,requested_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [input.supplierId, input.branch, input.reference ?? null, input.notes, userId],
    );
    const requestId = Number(request.rows[0].id);

    for (const item of input.items) {
      const linked = await client.query<{ id: number; branch: string }>(
        "SELECT id,branch FROM inventory_items WHERE id=$1 AND supplier_id=$2 AND status='active'",
        [item.inventoryItemId, input.supplierId],
      );
      if (!linked.rows[0]) throw new Error("ITEM_NOT_LINKED_TO_SUPPLIER");
      if (linked.rows[0].branch !== input.branch) throw new Error("ITEM_NOT_IN_BRANCH");
      await client.query(
        `INSERT INTO restock_request_items (restock_request_id,inventory_item_id,requested_quantity,unit_cost)
         VALUES ($1,$2,$3,$4)`,
        [requestId, item.inventoryItemId, item.requestedQuantity, item.unitCost ?? null],
      );
    }
    await client.query("COMMIT");
    return getRestockRequest(db, requestId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function listRestockRequests(db: Pool, supplierId?: number, requestedBy?: number) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (supplierId) {
    params.push(supplierId);
    conditions.push(`r.supplier_id=$${params.length}`);
  }
  if (requestedBy) {
    params.push(requestedBy);
    conditions.push(`r.requested_by=$${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT r.id,r.supplier_id,s.company_name AS supplier_name,r.status,r.branch,r.reference,r.notes,r.requested_by,
      r.received_by,r.received_at,r.created_at,r.updated_at,
       COALESCE(json_agg(json_build_object('id',ri.id,'inventoryItemId',ri.inventory_item_id,'itemName',i.name,'branch',i.branch,
        'requestedQuantity',ri.requested_quantity,'deliveredQuantity',ri.delivered_quantity,'unitCost',ri.unit_cost)
        ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL),'[]') AS items
     FROM restock_requests r JOIN suppliers s ON s.id=r.supplier_id
     LEFT JOIN restock_request_items ri ON ri.restock_request_id=r.id
     LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
     ${where} GROUP BY r.id,s.company_name ORDER BY r.created_at DESC`, params);
  return result.rows;
}

export async function getRestockRequest(db: Pool, id: number) {
  const result = await db.query(
    `SELECT r.id,r.supplier_id,s.company_name AS supplier_name,r.status,r.branch,r.reference,r.notes,r.requested_by,
      r.received_by,r.received_at,r.created_at,r.updated_at,
       COALESCE(json_agg(json_build_object('id',ri.id,'inventoryItemId',ri.inventory_item_id,'itemName',i.name,'branch',i.branch,
        'requestedQuantity',ri.requested_quantity,'deliveredQuantity',ri.delivered_quantity,'unitCost',ri.unit_cost)
        ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL),'[]') AS items
     FROM restock_requests r JOIN suppliers s ON s.id=r.supplier_id
     LEFT JOIN restock_request_items ri ON ri.restock_request_id=r.id
     LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
     WHERE r.id=$1 GROUP BY r.id,s.company_name`, [id]);
  return result.rows[0] ?? null;
}

export async function updateSupplierRestockStatus(db: Pool, id: number, supplierId: number, status: string) {
  const current = await db.query<{ status: string }>("SELECT status FROM restock_requests WHERE id=$1 AND supplier_id=$2", [id, supplierId]);
  if (!current.rows[0]) throw new Error("RESTOCK_NOT_FOUND");
  if (!(supplierTransitions[current.rows[0].status] ?? []).includes(status)) throw new Error("INVALID_STATUS_TRANSITION");
  await db.query("UPDATE restock_requests SET status=$1,updated_at=NOW() WHERE id=$2", [status, id]);
  return getRestockRequest(db, id);
}

export async function markRestockDelivered(db: Pool, id: number) {
  const result = await db.query<{ id: number }>(
    "UPDATE restock_requests SET status='Delivered',updated_at=NOW() WHERE id=$1 AND status='Shipped' RETURNING id",
    [id],
  );
  if (!result.rows[0]) throw new Error("INVALID_STATUS_TRANSITION");
  return getRestockRequest(db, id);
}

export async function receiveRestock(db: Pool, id: number, userId: number, input: ReceiveRestockInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query<{ supplier_id: number; status: string; received_at: Date | null; branch: string }>(
      "SELECT supplier_id,status,received_at,branch FROM restock_requests WHERE id=$1 FOR UPDATE", [id]);
    const header = request.rows[0];
    if (!header) throw new Error("RESTOCK_NOT_FOUND");
    if (header.received_at || header.status === "Received") throw new Error("ALREADY_RECEIVED");
    if (header.status !== "Delivered") throw new Error("NOT_READY_TO_RECEIVE");

    const lines = await client.query<{ id: number; inventory_item_id: number; requested_quantity: number }>(
      "SELECT id,inventory_item_id,requested_quantity FROM restock_request_items WHERE restock_request_id=$1 ORDER BY id FOR UPDATE",
      [id],
    );
    const lineById = new Map(lines.rows.map((line) => [Number(line.id), line]));
    if (input.items.length !== lines.rows.length
      || new Set(input.items.map((received) => received.restockRequestItemId)).size !== input.items.length
      || input.items.some((received) => !lineById.has(received.restockRequestItemId))) {
      throw new Error("RESTOCK_LINES_INCOMPLETE");
    }

    for (const received of input.items) {
      const line = lineById.get(received.restockRequestItemId);
      if (!line) throw new Error("RESTOCK_LINE_NOT_FOUND");
      if (received.deliveredQuantity > Number(line.requested_quantity)) {
        throw new Error("DELIVERED_QUANTITY_EXCEEDS_REQUESTED");
      }
      const itemId = Number(line.inventory_item_id);
      const stock = await client.query<{ quantity: number; unit_cost: number | string }>(
        "SELECT quantity,unit_cost FROM inventory_items WHERE id=$1 AND supplier_id=$2 AND branch=$3 FOR UPDATE",
        [itemId, header.supplier_id, header.branch]);
      if (!stock.rows[0]) throw new Error("INVENTORY_NOT_FOUND");
      const previous = Number(stock.rows[0].quantity);
      const next = previous + received.deliveredQuantity;
      const cost = received.unitCost ?? Number(stock.rows[0].unit_cost);
      await client.query("UPDATE inventory_items SET quantity=$1,unit_cost=$2,updated_at=NOW() WHERE id=$3", [next, cost, itemId]);
      await resolveLowStockAcknowledgements(client, itemId, next);
      await client.query("UPDATE restock_request_items SET delivered_quantity=$1,unit_cost=$2 WHERE id=$3", [received.deliveredQuantity, cost, received.restockRequestItemId]);
      if (received.deliveredQuantity > 0) {
        await client.query(
          `INSERT INTO inventory_movements (inventory_item_id,supplier_id,branch,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by)
           VALUES ($1,$2,$3,'RECEIVE',$4,$5,$6,$7,$8,$9,$10)`,
          [itemId, header.supplier_id, header.branch, received.deliveredQuantity, previous, next, cost, input.reference ?? null, input.notes, userId],
        );
      }
    }
    await client.query(
      "UPDATE restock_requests SET status='Received',reference=COALESCE($1,reference),notes=CASE WHEN $2='' THEN notes ELSE $2 END,received_by=$3,received_at=NOW(),updated_at=NOW() WHERE id=$4",
      [input.reference ?? null, input.notes, userId, id],
    );
    await client.query("COMMIT");
    return getRestockRequest(db, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
