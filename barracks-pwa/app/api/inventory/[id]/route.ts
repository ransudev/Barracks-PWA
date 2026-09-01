import { requireAdministrator } from "@/server/auth/require-admin";
import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { formatValidationErrors, inventoryItemSchema } from "@/server/schemas/sprint.schema";
import { deleteInventory, findInventoryById, updateInventory } from "@/server/services/inventory.service";

export const runtime = "nodejs";

function parseId(rawId: string): number | null {
  return /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  try {
    const item = await findInventoryById(pool, id);
    if (!item) return Response.json({ success: false, message: "Inventory item not found" }, { status: 404 });
    return Response.json({ success: true, item });
  } catch (error) {
    console.error("Unable to load inventory item", error);
    return Response.json({ success: false, message: "Unable to load inventory item" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid inventory information" }, { status: 400 });
  }
  const parsed = inventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid inventory information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  }
  try {
    const item = await updateInventory(pool, id, parsed.data);
    if (!item) return Response.json({ success: false, message: "Inventory item not found" }, { status: 404 });
    return Response.json({ success: true, item });
  } catch (error) {
    console.error("Unable to update inventory item", error);
    return Response.json({ success: false, message: "Unable to update inventory item" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  try {
    if (!(await deleteInventory(pool, id))) return Response.json({ success: false, message: "Inventory item not found" }, { status: 404 });
    return Response.json({ success: true, message: "Inventory item deleted" });
  } catch (error) {
    console.error("Unable to delete inventory item", error);
    return Response.json({ success: false, message: "Unable to delete inventory item" }, { status: 500 });
  }
}
