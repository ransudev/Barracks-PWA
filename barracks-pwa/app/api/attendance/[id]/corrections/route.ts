import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { attendanceCorrectionSchema } from "@/server/schemas/attendance.schema";
import { AttendanceConflict, correctAttendance, listAttendanceCorrections } from "@/server/services/attendance.service";

export const runtime = "nodejs";

function readId(raw: string): number | null {
  const id = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireManagementUser();
  if (user instanceof Response) return user;
  const id = readId((await params).id);
  if (id === null) return Response.json({ success: false, message: "Invalid attendance id" }, { status: 400 });
  try { return Response.json({ success: true, corrections: await listAttendanceCorrections(pool, id) }); }
  catch (error) {
    console.error("Unable to load attendance corrections", error);
    return Response.json({ success: false, message: "Unable to load corrections" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireManagementUser();
  if (user instanceof Response) return user;
  const id = readId((await params).id);
  if (id === null) return Response.json({ success: false, message: "Invalid attendance id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: "Invalid correction" }, { status: 400 }); }
  const parsed = attendanceCorrectionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid correction" }, { status: 400 });
  try {
    const attendance = await correctAttendance(pool, id, user.id, parsed.data);
    return attendance ? Response.json({ success: true, attendance })
      : Response.json({ success: false, message: "Attendance not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof AttendanceConflict) return Response.json({ success: false, message: error.message }, { status: 409 });
    console.error("Unable to correct attendance", error);
    return Response.json({ success: false, message: "Unable to correct attendance" }, { status: 500 });
  }
}
