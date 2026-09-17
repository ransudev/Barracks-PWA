import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { supplierSchema } from "@/server/schemas/sprint2.schema";
import { findSupplier, getSupplierProfile, updateSupplier } from "@/server/services/supplier.service";

export const runtime = "nodejs";
const parseId = (raw: string) => /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff(); if (denied) return denied;
  const id = parseId((await params).id); if (!id) return Response.json({ success:false,message:"Invalid supplier id" },{status:400});
  const profile = await getSupplierProfile(pool, id);
  return profile ? Response.json({ success:true, profile }) : Response.json({ success:false,message:"Supplier not found" },{status:404});
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff(); if (denied) return denied;
  const id = parseId((await params).id); if (!id) return Response.json({ success:false,message:"Invalid supplier id" },{status:400});
  let body: unknown; try { body = await request.json(); } catch { return Response.json({success:false,message:"Invalid supplier information"},{status:400}); }
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return Response.json({success:false,message:"Invalid supplier information",errors:parsed.error.flatten().fieldErrors},{status:400});
  try {
    const supplier = await updateSupplier(pool,id,parsed.data);
    return supplier ? Response.json({success:true,supplier}) : Response.json({success:false,message:"Supplier not found"},{status:404});
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_SUPPLIER_NAME") {
      return Response.json({ success: false, message: "An active supplier with this company name already exists" }, { status: 409 });
    }
    console.error("Unable to update supplier", error);
    return Response.json({ success:false, message:"Unable to update supplier" }, { status:500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff(); if (denied) return denied;
  const id = parseId((await params).id); if (!id) return Response.json({ success:false,message:"Invalid supplier id" },{status:400});
  if (!(await findSupplier(pool,id))) return Response.json({success:false,message:"Supplier not found"},{status:404});
  await pool.query("UPDATE suppliers SET status='inactive',updated_at=NOW() WHERE id=$1",[id]);
  return Response.json({success:true,message:"Supplier deactivated"});
}
