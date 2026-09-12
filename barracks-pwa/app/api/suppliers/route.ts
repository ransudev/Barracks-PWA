import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { supplierSchema } from "@/server/schemas/sprint2.schema";
import { createSupplier, listSuppliers } from "@/server/services/supplier.service";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdministrator();
  if (denied) return denied;
  try {
    return Response.json({ success: true, suppliers: await listSuppliers(pool) });
  } catch (error) {
    console.error("Unable to list suppliers", error);
    return Response.json({ success: false, message: "Unable to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdministrator();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid supplier information" }, { status: 400 });
  }
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid supplier information" }, { status: 400 });
  try {
    return Response.json({ success: true, supplier: await createSupplier(pool, parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create supplier", error);
    return Response.json({ success: false, message: "Unable to create supplier" }, { status: 500 });
  }
}
