import { requireAdministrator, requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { inventoryCreateSchema } from "@/server/schemas/sprint2.schema";
import { createInventoryItem, listInventory } from "@/server/services/inventory.service";

export const runtime = "nodejs";

export async function GET() {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  try {
    return Response.json({ success: true, items: await listInventory(pool) });
  } catch (error) {
    console.error("Unable to list inventory", error);
    return Response.json({ success: false, message: "Unable to load inventory" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid inventory information" }, { status: 400 });
  }
  const parsed = inventoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid inventory information", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    return Response.json({ success: true, item: await createInventoryItem(pool, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_UNAVAILABLE") {
      return Response.json({ success: false, message: "Supplier is inactive or unavailable" }, { status: 400 });
    }
    console.error("Unable to create inventory item", error);
    return Response.json({ success: false, message: "Unable to create inventory item" }, { status: 500 });
  }
}
