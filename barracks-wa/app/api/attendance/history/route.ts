import { BranchError } from "@/server/services/branch.service";
import { branchApiError } from "@/server/services/branch-api";
import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { attendanceHistorySchema } from "@/server/schemas/attendance.schema";
import { attendanceBranches, listAttendanceHistory } from "@/server/services/attendance.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireManagementUser();
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const parsed = attendanceHistorySchema.safeParse(Object.fromEntries([...url.searchParams].filter(([key]) => key !== "branchId")));
  if (!parsed.success) return Response.json({ success: false, message: "Invalid attendance filters" }, { status: 400 });
  try { return Response.json({ success: true, attendance: await listAttendanceHistory(pool, parsed.data, await attendanceBranches(pool, user, request)) }); }
  catch (error) {
    if (error instanceof BranchError) return branchApiError(error);
    console.error("Unable to load attendance history", error);
    return Response.json({ success: false, message: "Unable to load attendance history" }, { status: 500 });
  }
}
