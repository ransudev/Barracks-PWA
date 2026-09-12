import { requireSupplierUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { getSupplierProfile, supplierIdForUser } from "@/server/services/supplier.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireSupplierUser();
  if (user instanceof Response) return user;
  const supplierId = await supplierIdForUser(pool, user.id);
  if (!supplierId) return Response.json({ success: false, message: "Supplier account is not linked to a supplier profile" }, { status: 403 });
  const profile = await getSupplierProfile(pool, supplierId);
  if (!profile) return Response.json({ success: false, message: "Supplier profile not found" }, { status: 404 });
  return Response.json({ success: true, profile });
}
