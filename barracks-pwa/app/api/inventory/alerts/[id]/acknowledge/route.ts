import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { acknowledgeLowStockAlert } from "@/server/services/inventory-alert.service";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  try {
    const alert = await acknowledgeLowStockAlert(pool, id, user.id);
    return Response.json({ success: true, alert });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVENTORY_NOT_FOUND") return Response.json({ success: false, message: "Inventory item not found" }, { status: 404 });
    if (code === "ALERT_NOT_ACTIVE") return Response.json({ success: false, message: "This stock alert is no longer active" }, { status: 409 });
    console.error("Unable to acknowledge inventory alert", error);
    return Response.json({ success: false, message: "Unable to acknowledge inventory alert" }, { status: 500 });
  }
}

