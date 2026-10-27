import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { payrollCommandSchema, payrollQuerySchema } from "@/server/schemas/payroll.schema";
import { mutatePayroll, PayrollError, readPayroll } from "@/server/services/payroll.service";
import { BranchError } from "@/server/services/branch.service";
export const runtime = "nodejs";
function failure(error: unknown) {
  if (error instanceof PayrollError || error instanceof BranchError) return Response.json({ success: false, message: error.message }, { status: error.status });
  if (error && typeof error==='object' && 'code' in error) {
    if (error.code==='23505') return Response.json({ success: false, message: "This payroll setting, rate, correction, or payment has already been recorded" }, { status: 409 });
    if (error.code==='23514') return Response.json({ success: false, message: 'message' in error ? error.message : "Payroll rules prevented this change" }, { status: 409 });
  }
  console.error("Payroll request failed",error);
  return Response.json({ success: false, message: "Unable to process payroll. Ensure the payroll migration has been applied." }, { status: 500 });
}
export async function GET(request: Request) {
  const actor = await requireManagementUser();
  if (actor instanceof Response) return actor;
  const parsed = payrollQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ success: false, message: "Select a valid branch and payroll filters" }, { status: 400 });
  try { return Response.json({ success: true, ...await readPayroll(pool,actor,parsed.data) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const actor = await requireManagementUser();
  if (actor instanceof Response) return actor;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, message: "Invalid payroll information" }, { status: 400 }); }
  const parsed = payrollCommandSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: parsed.error.issues.map(i=>i.message).join("; ") }, { status: 400 });
  try { return Response.json({ success: true, ...await mutatePayroll(pool,actor,parsed.data) }); }
  catch (error) { return failure(error); }
}
