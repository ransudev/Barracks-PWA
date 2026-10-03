import { requireManagement } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import type { ManagementDashboardData } from "@/app/types/dashboard";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireManagement();
  if (denied) return denied;
  const startedAt = Date.now();
  try {
    const [summary, lowStock, deliveries] = await Promise.all([
      pool.query(`SELECT
        (SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM inventory_items) AS inventory_value,
        (SELECT COUNT(*) FROM restock_requests WHERE status NOT IN ('Received', 'Cancelled')) AS open_restocks,
        (SELECT COUNT(*) FROM bookings b JOIN customers c ON c.id = b.customer_id
          JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL JOIN barbers br ON br.id = b.barber_id
          WHERE b.booking_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date AND b.status <> 'cancelled') AS today_bookings,
        (SELECT COUNT(*) FROM bookings b JOIN customers c ON c.id = b.customer_id
          JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL JOIN barbers br ON br.id = b.barber_id
          WHERE b.booking_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date AND b.status = 'confirmed') AS upcoming_bookings,
        (SELECT COUNT(*) FROM barbers WHERE status <> 'unavailable') AS active_barbers,
        (SELECT COUNT(*) FROM customers c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN roles r ON r.id = u.role_id
          WHERE c.user_id IS NULL OR (u.deleted_at IS NULL AND r.name = 'customer')) AS customer_count`),
      pool.query<ManagementDashboardData["lowStock"][number]>(`SELECT i.id, i.name, s.company_name AS "supplierName", i.category,
        i.quantity, i.minimum_stock AS "minimumStock", i.unit
        FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.status = 'active' AND i.quantity <= i.minimum_stock ORDER BY i.name ASC, i.id ASC`),
      pool.query<ManagementDashboardData["recentDeliveries"][number]>(`SELECT r.id, s.company_name AS supplier_name, r.reference, r.received_at
        FROM restock_requests r JOIN suppliers s ON s.id = r.supplier_id
        WHERE r.status = 'Received' ORDER BY r.created_at DESC LIMIT 5`),
    ]);
    const row = summary.rows[0];
    const dashboard: ManagementDashboardData = {
      inventoryValue: Number(row.inventory_value), openRestocks: Number(row.open_restocks),
      todayBookings: Number(row.today_bookings), upcomingBookings: Number(row.upcoming_bookings),
      activeBarbers: Number(row.active_barbers), customerCount: Number(row.customer_count),
      lowStock: lowStock.rows, recentDeliveries: deliveries.rows,
    };
    console.info(JSON.stringify({ route: "/api/dashboard/management", ms: Date.now() - startedAt }));
    return Response.json({ success: true, dashboard }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load management dashboard", error);
    return Response.json({ success: false, message: "Unable to load dashboard" }, { status: 500 });
  }
}
