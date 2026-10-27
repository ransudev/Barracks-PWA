import { requireSupplierUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { supplierProfileUpdateSchema } from "@/server/schemas/sprint2.schema";
import { findSupplier, getSupplierProfile, supplierIdForUser, updateSupplier } from "@/server/services/supplier.service";

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

export async function PATCH(request: Request) {
  const user = await requireSupplierUser();
  if (user instanceof Response) return user;
  const supplierId = await supplierIdForUser(pool, user.id);
  if (!supplierId) return Response.json({ success: false, message: "Supplier account is not linked to a supplier profile" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid supplier information" }, { status: 400 });
  }

  const parsed = supplierProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      success: false,
      message: "Invalid supplier information",
      errors: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const current = await findSupplier(pool, supplierId);
  if (!current) return Response.json({ success: false, message: "Supplier profile not found" }, { status: 404 });

  try {
    const supplier = await updateSupplier(pool, supplierId, { ...parsed.data, status: current.status });
    return supplier
      ? Response.json({ success: true, supplier })
      : Response.json({ success: false, message: "Supplier profile not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_SUPPLIER_NAME") {
      return Response.json({ success: false, message: "An active supplier with this company name already exists" }, { status: 409 });
    }
    console.error("Unable to update supplier profile", error);
    return Response.json({ success: false, message: "Unable to update supplier profile" }, { status: 500 });
  }
}
