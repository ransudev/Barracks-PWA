import { withInventoryOwner, inventoryBranchError } from "@/server/auth/inventory-branch-access";
import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { listInventoryThresholdHistory } from "@/server/services/inventory.service";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireManagementUser();
  if (staff instanceof Response) return staff;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  try {
    return Response.json({ success: true, history: await withInventoryOwner(pool, staff, request, "inventory_items", id, (client) => listInventoryThresholdHistory(client, id)) });
  } catch (error) {
    const branchError = inventoryBranchError(error); if (branchError) return branchError;
    console.error("Unable to load inventory threshold history", error);
    return Response.json({ success: false, message: "Unable to load threshold history" }, { status: 500 });
  }
}

