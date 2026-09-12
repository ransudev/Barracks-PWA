import { requireAdministratorUser, requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { inventoryMovementSchema } from "@/server/schemas/sprint2.schema";
import { applyInventoryMovement, listInventoryMovements } from "@/server/services/inventory-movement.service";

export const runtime = "nodejs";
const parseId = (raw: string) => /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(); if (user instanceof Response) return user;
  const id = parseId((await params).id); if (!id) return Response.json({success:false,message:"Invalid inventory item id"},{status:400});
  return Response.json({success:true,movements:await listInventoryMovements(pool,id)});
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffUser(); if (staff instanceof Response) return staff;
  const id = parseId((await params).id); if (!id) return Response.json({success:false,message:"Invalid inventory item id"},{status:400});
  let body: unknown; try { body = await request.json(); } catch { return Response.json({success:false,message:"Invalid stock operation"},{status:400}); }
  const parsed = inventoryMovementSchema.safeParse(body); if (!parsed.success) return Response.json({success:false,message:"Invalid stock operation"},{status:400});
  if (parsed.data.movementType === "ADJUSTMENT") {
    const admin = await requireAdministratorUser(); if (admin instanceof Response) return admin;
  }
  try {
    const movement = await applyInventoryMovement(pool,id,staff.id,parsed.data);
    return Response.json({success:true,movement},{status:201});
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "NEGATIVE_STOCK" ? "Stock cannot become negative" : code === "INVENTORY_NOT_FOUND" ? "Inventory item not found" : "Unable to record stock operation";
    return Response.json({success:false,message},{status:400});
  }
}
