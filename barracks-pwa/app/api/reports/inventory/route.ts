import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdministrator();
  if (denied) return denied;

  try {
    const [valuation, supplierSpending, movements] = await Promise.all([
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
        LEFT JOIN restock_requests r ON r.supplier_id=s.id AND r.status='Received'
        LEFT JOIN restock_request_items ri ON ri.restock_request_id=r.id
        LEFT JOIN inventory_items i ON i.id=ri.inventory_item_id
        GROUP BY s.id, s.company_name
        ORDER BY total_spend DESC, s.company_name ASC
      `),
      pool.query(`
        SELECT m.id, m.movement_type, m.quantity, m.previous_stock, m.new_stock, m.unit_cost,
          m.reference, m.notes, m.created_at, i.name AS item_name,
          s.company_name AS supplier_name,
          u.first_name || ' ' || u.last_name AS created_by_name
        FROM inventory_movements m
        JOIN inventory_items i ON i.id=m.inventory_item_id
        JOIN users u ON u.id=m.created_by
        LEFT JOIN suppliers s ON s.id=m.supplier_id
        ORDER BY m.created_at DESC
        LIMIT 100
      `),
    ]);

    const totals = valuation.rows[0] ?? { total_value: 0, active_items: 0, low_stock_items: 0 };
    return Response.json({
      success: true,
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
      movements: movements.rows,
    });
  } catch (error) {
    console.error("Unable to load inventory reports", error);
    return Response.json({ success: false, message: "Unable to load inventory reports" }, { status: 500 });
  }
}
