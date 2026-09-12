import type { Pool } from "pg";
import type { ReceiveRestockInput, RestockCreateInput } from "@/server/schemas/sprint2.schema";

const supplierTransitions: Record<string, string[]> = {
  Pending: ["Accepted", "Cancelled"],
  Accepted: ["Preparing", "Cancelled"],
  Preparing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
};

export async function createRestockRequest(db: Pool, userId: number, input: RestockCreateInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const supplier = await client.query("SELECT id FROM suppliers WHERE id=$1 AND status='active'", [input.supplierId]);
    if (!supplier.rows[0]) throw new Error("SUPPLIER_UNAVAILABLE");

    const request = await client.query<{ id: number }>(
      `INSERT INTO restock_requests (supplier_id,reference,notes,requested_by)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [input.supplierId, input.reference ?? null, input.notes, userId],
    );
    const requestId = Number(request.rows[0].id);

    for (const item of input.items) {
      const linked = await client.query(
        "SELECT id FROM inventory_items WHERE id=$1 AND supplier_id=$2 AND status='active'",
        [item.inventoryItemId, input.supplierId],
      );
      if (!linked.rows[0]) throw new Error("ITEM_NOT_LINKED_TO_SUPPLIER");
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

export async function listRestockRequests(db: Pool, supplierId?: number) {
  const params: unknown[] = [];
  const where = supplierId ? (params.push(supplierId), "WHERE r.supplier_id=$1") : "";
  const result = await db.query(
    `SELECT r.id,r.supplier_id,s.company_name AS supplier_name,r.status,r.reference,r.notes,r.requested_by,
      r.received_by,r.received_at,r.created_at,r.updated_at,
      COALESCE(json_agg(json_build_object('id',ri.id,'inventoryItemId',ri.inventory_item_id,'itemName',i.name,
        'requestedQuantity',ri.requested_quantity,'deliveredQuantity',ri.delivered_quantity,'unitCost',ri.unit_cost)
        ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL),'[]') AS items
     FROM restock_requests r JOIN suppliers s ON s.id=r.supplier_id
     LEFT JOIN restock_request_items ri ON ri.restock_request_id=r.id
     LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
     ${where} GROUP BY r.id,s.company_name ORDER BY r.created_at DESC`, params);
  return result.rows;
}

export async function getRestockRequest(db: Pool, id: number) {
  const rows = await listRestockRequests(db);
  return rows.find((row) => Number(row.id) === id) ?? null;
}

export async function updateSupplierRestockStatus(db: Pool, id: number, supplierId: number, status: string) {
  const current = await db.query<{ status: string }>("SELECT status FROM restock_requests WHERE id=$1 AND supplier_id=$2", [id, supplierId]);
  if (!current.rows[0]) throw new Error("RESTOCK_NOT_FOUND");
  if (!(supplierTransitions[current.rows[0].status] ?? []).includes(status)) throw new Error("INVALID_STATUS_TRANSITION");
  await db.query("UPDATE restock_requests SET status=$1,updated_at=NOW() WHERE id=$2", [status, id]);
  return getRestockRequest(db, id);
}

export async function receiveRestock(db: Pool, id: number, userId: number, input: ReceiveRestockInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const request = await client.query<{ supplier_id: number; status: string; received_at: Date | null }>(
      "SELECT supplier_id,status,received_at FROM restock_requests WHERE id=$1 FOR UPDATE", [id]);
    const header = request.rows[0];
    if (!header) throw new Error("RESTOCK_NOT_FOUND");
    if (header.received_at || header.status === "Received") throw new Error("ALREADY_RECEIVED");
    if (header.status !== "Delivered" && header.status !== "Shipped") throw new Error("NOT_READY_TO_RECEIVE");

    for (const received of input.items) {
      const line = await client.query<{ inventory_item_id: number; requested_quantity: number }>(
        "SELECT inventory_item_id,requested_quantity FROM restock_request_items WHERE id=$1 AND restock_request_id=$2 FOR UPDATE",
        [received.restockRequestItemId, id]);
      if (!line.rows[0]) throw new Error("RESTOCK_LINE_NOT_FOUND");
      const itemId = Number(line.rows[0].inventory_item_id);
      const stock = await client.query<{ quantity: number; unit_cost: number | string }>(
        "SELECT quantity,unit_cost FROM inventory_items WHERE id=$1 FOR UPDATE", [itemId]);
      if (!stock.rows[0]) throw new Error("INVENTORY_NOT_FOUND");
      const previous = Number(stock.rows[0].quantity);
      const next = previous + received.deliveredQuantity;
      const cost = received.unitCost ?? Number(stock.rows[0].unit_cost);
      await client.query("UPDATE inventory_items SET quantity=$1,unit_cost=$2,updated_at=NOW() WHERE id=$3", [next, cost, itemId]);
      await client.query("UPDATE restock_request_items SET delivered_quantity=$1,unit_cost=$2 WHERE id=$3", [received.deliveredQuantity, cost, received.restockRequestItemId]);
      if (received.deliveredQuantity > 0) {
        await client.query(
          `INSERT INTO inventory_movements (inventory_item_id,supplier_id,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by)
           VALUES ($1,$2,'RECEIVE',$3,$4,$5,$6,$7,$8,$9)`,
          [itemId, header.supplier_id, received.deliveredQuantity, previous, next, cost, input.reference ?? null, input.notes, userId],
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
