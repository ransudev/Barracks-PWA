import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { attendanceActionSchema } from "@/server/schemas/attendance.schema";
import { actOnTodayAttendance, AttendanceConflict } from "@/server/services/attendance.service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ barberId: string }> }) {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  const rawId = (await params).barberId;
  const barberId = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(barberId) || barberId < 1)
    return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: "Invalid attendance action" }, { status: 400 }); }
  const parsed = attendanceActionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid attendance action" }, { status: 400 });
  try {
    const attendance = await actOnTodayAttendance(pool, barberId, user.id, parsed.data);
    return attendance ? Response.json({ success: true, attendance })
      : Response.json({ success: false, message: "Barber not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof AttendanceConflict) return Response.json({ success: false, message: error.message }, { status: 409 });
    console.error("Unable to update attendance", error);
    return Response.json({ success: false, message: "Unable to update attendance" }, { status: 500 });
  }
}
