import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { formatValidationErrors, inventoryItemSchema } from "@/server/schemas/sprint.schema";
import { createInventory, listInventory } from "@/server/services/inventory.service";

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
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid inventory information" }, { status: 400 });
  }
  const parsed = inventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid inventory information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  }
  try {
    return Response.json({ success: true, item: await createInventory(pool, parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create inventory item", error);
    return Response.json({ success: false, message: "Unable to create inventory item" }, { status: 500 });
  }
}
