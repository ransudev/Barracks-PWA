import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { listLowStockAlerts } from "@/server/services/inventory-alert.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ success: true, alerts: await listLowStockAlerts(pool, user.id) });
  } catch (error) {
    console.error("Unable to load inventory alerts", error);
    return Response.json({ success: false, message: "Unable to load inventory alerts" }, { status: 500 });
  }
}

