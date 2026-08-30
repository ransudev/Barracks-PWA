import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { createBarber, listBarbers } from "@/server/services/barber.service";

export const runtime = "nodejs";

export async function GET() {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  try {
    return Response.json({ success: true, barbers: await listBarbers(pool) });
  } catch (error) {
    console.error("Unable to list barbers", error);
    return Response.json({ success: false, message: "Unable to load barbers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid barber information" }, { status: 400 });
  }
  const parsed = barberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid barber information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  }
  try {
    return Response.json({ success: true, barber: await createBarber(pool, parsed.data) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create barber", error);
    return Response.json({ success: false, message: "Unable to create barber" }, { status: 500 });
  }
}
