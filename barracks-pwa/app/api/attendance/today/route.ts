import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { listTodayAttendance } from "@/server/services/attendance.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  try { return Response.json({ success: true, attendance: await listTodayAttendance(pool) }); }
  catch (error) {
    console.error("Unable to load today's attendance", error);
    return Response.json({ success: false, message: "Unable to load attendance" }, { status: 500 });
  }
}
