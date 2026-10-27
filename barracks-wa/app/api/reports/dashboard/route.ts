import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { getDashboardReport } from "@/server/services/dashboard-report.service";
import { branchApiError } from "@/server/services/branch-api";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireManagementUser();
  if (actor instanceof Response) return actor;
  try {
    return Response.json({ success: true, ...await getDashboardReport(pool, actor, new URL(request.url).searchParams.get("branchId")) });
  } catch (error) { return branchApiError(error); }
}
