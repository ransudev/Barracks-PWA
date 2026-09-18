import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";

export const runtime = "nodejs";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || dateOnly(date) !== raw ? null : date;
}

export async function GET(request: Request) {
  const denied = await requireAdministrator();
  if (denied) return denied;

  const url = new URL(request.url);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const from = rawFrom ? parseDate(rawFrom) : defaultFrom;
  const to = rawTo ? parseDate(rawTo) : today;
  if (!from || !to || from > to) {
    return Response.json({ success: false, message: "Invalid report date range" }, { status: 400 });
  }

  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const periodMs = toExclusive.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - periodMs);
  const previousTo = new Date(from);

  try {
    const [valuation, supplierSpending, movements, usageSummary] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(quantity * unit_cost), 0) AS total_value,
          COUNT(*) FILTER (WHERE status='active') AS active_items,
          COUNT(*) FILTER (WHERE status='active' AND quantity <= minimum_stock) AS low_stock_items
        FROM inventory_items
      `),
      pool.query(`
        SELECT s.id AS supplier_id, s.company_name AS supplier_name,
          COALESCE(SUM(ri.delivered_quantity * COALESCE(ri.unit_cost, i.unit_cost)), 0) AS total_spend,
          COUNT(DISTINCT r.id) AS received_deliveries
        FROM suppliers s
        LEFT JOIN restock_requests r ON r.supplier_id=s.id
          AND r.status='Received'
          AND r.received_at >= $1
          AND r.received_at < $2
        LEFT JOIN restock_request_items ri ON ri.restock_request_id=r.id
        LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
        GROUP BY s.id, s.company_name
        ORDER BY total_spend DESC, s.company_name ASC
      `, [from, toExclusive]),
      pool.query(`
        SELECT m.id, m.movement_type, m.quantity, m.previous_stock, m.new_stock, m.unit_cost,
          m.reference, m.notes, m.created_at, i.name AS item_name, i.branch,
          s.company_name AS supplier_name,
          u.first_name || ' ' || u.last_name AS created_by_name
        FROM inventory_movements m
        JOIN inventory_items i ON i.id=m.inventory_item_id
        JOIN users u ON u.id=m.created_by
        LEFT JOIN suppliers s ON s.id=m.supplier_id
        WHERE m.created_at >= $1 AND m.created_at < $2
        ORDER BY m.created_at DESC
        LIMIT 250
      `, [from, toExclusive]),
      pool.query(`
        SELECT
          i.id AS item_id,
          i.name AS item_name,
          i.branch,
          i.quantity AS current_quantity,
          i.minimum_stock,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type IN ('RECEIVE','RETURN') THEN m.quantity ELSE 0 END),0) AS received,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type IN ('USE','STAFF_USAGE') THEN m.quantity ELSE 0 END),0) AS used,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type='CUSTOMER_PURCHASE' THEN m.quantity ELSE 0 END),0) AS sold,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type IN ('DAMAGE','DISCARD') THEN m.quantity ELSE 0 END),0) AS wasted,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type='ADJUSTMENT' THEN m.quantity ELSE 0 END),0) AS adjusted,
          COALESCE(SUM(CASE WHEN m.created_at >= $1 AND m.created_at < $2 AND m.movement_type IN ('USE','STAFF_USAGE','CUSTOMER_PURCHASE','DAMAGE','DISCARD') THEN m.quantity ELSE 0 END),0) AS current_activity,
          COALESCE(SUM(CASE WHEN m.created_at >= $3 AND m.created_at < $4 AND m.movement_type IN ('USE','STAFF_USAGE','CUSTOMER_PURCHASE','DAMAGE','DISCARD') THEN m.quantity ELSE 0 END),0) AS previous_activity
        FROM inventory_items i
        LEFT JOIN inventory_movements m ON m.inventory_item_id=i.id
          AND m.created_at >= $3 AND m.created_at < $2
        WHERE i.status='active'
        GROUP BY i.id,i.name,i.branch,i.quantity,i.minimum_stock
        ORDER BY current_activity DESC, i.name ASC
      `, [from, toExclusive, previousFrom, previousTo]),
    ]);

    const totals = valuation.rows[0] ?? { total_value: 0, active_items: 0, low_stock_items: 0 };
    return Response.json({
      success: true,
      range: {
        from: dateOnly(from),
        to: dateOnly(to),
        previousFrom: dateOnly(previousFrom),
        previousTo: dateOnly(new Date(previousTo.getTime() - 86400000)),
      },
      valuation: {
        totalValue: Number(totals.total_value ?? 0),
        activeItems: Number(totals.active_items ?? 0),
        lowStockItems: Number(totals.low_stock_items ?? 0),
      },
      supplierSpending: supplierSpending.rows.map((row) => ({
        supplierId: Number(row.supplier_id),
        supplierName: row.supplier_name,
        totalSpend: Number(row.total_spend ?? 0),
        receivedDeliveries: Number(row.received_deliveries ?? 0),
      })),
      usageSummary: usageSummary.rows.map((row) => ({
        itemId: Number(row.item_id),
        itemName: row.item_name,
        branch: row.branch,
        currentQuantity: Number(row.current_quantity),
        minimumStock: Number(row.minimum_stock),
        received: Number(row.received),
        used: Number(row.used),
        sold: Number(row.sold),
        wasted: Number(row.wasted),
        adjusted: Number(row.adjusted),
        currentActivity: Number(row.current_activity),
        previousActivity: Number(row.previous_activity),
      })),
      movements: movements.rows,
    });
  } catch (error) {
    console.error("Unable to load inventory reports", error);
    return Response.json({ success: false, message: "Unable to load inventory reports" }, { status: 500 });
  }
}
