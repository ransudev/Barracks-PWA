import { BranchError } from "@/server/services/branch.service";
import { branchApiError } from "@/server/services/branch-api";
import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { attendanceBranches, listTodayAttendance } from "@/server/services/attendance.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  try { return Response.json({ success: true, attendance: await listTodayAttendance(pool, await attendanceBranches(pool, user, request)) }); }
  catch (error) {
    if (error instanceof BranchError) return branchApiError(error);
    console.error("Unable to load today's attendance", error);
    return Response.json({ success: false, message: "Unable to load attendance" }, { status: 500 });
  }
}
