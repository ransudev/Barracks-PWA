import { requireAdministrator, requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { inventoryMetadataSchema } from "@/server/schemas/sprint2.schema";
import { deleteInventory, findInventoryById, updateInventoryMetadata } from "@/server/services/inventory.service";

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
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid inventory item id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid inventory information" }, { status: 400 });
  }
  const parsed = inventoryMetadataSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid inventory information", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const item = await updateInventoryMetadata(pool, id, parsed.data);
    if (!item) return Response.json({ success: false, message: "Inventory item not found" }, { status: 404 });
    return Response.json({ success: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_UNAVAILABLE") {
      return Response.json({ success: false, message: "Supplier is inactive or unavailable" }, { status: 400 });
    }
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
    return Response.json({ success: true, message: "Inventory item deactivated or deleted" });
  } catch (error) {
    console.error("Unable to delete inventory item", error);
    return Response.json({ success: false, message: "Unable to deactivate inventory item" }, { status: 500 });
  }
}
