import { requireAdministrator, requireManagement, requireRolesUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberCommissionSchema, barberSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { createBarber, listBarberAvailability, listBarbers, updateAllBarberCommissionRates } from "@/server/services/barber.service";

export const runtime = "nodejs";

export async function GET() {
  const authorizationResult = await requireRolesUser(["administrator", "manager", "front_desk", "customer"]);
  if (authorizationResult instanceof Response) return authorizationResult;
  try {
    const barbers = authorizationResult.role === "customer" || authorizationResult.role === "front_desk"
      ? await listBarberAvailability(pool)
      : await listBarbers(pool);
    return Response.json({ success: true, barbers });
  } catch (error) {
    console.error("Unable to list barbers", error);
    return Response.json({ success: false, message: "Unable to load barbers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireManagement();
  if (denied) return denied;
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

export async function PATCH(request: Request) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid commission information" }, { status: 400 });
  }

  const parsed = barberCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid commission information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const barbers = await updateAllBarberCommissionRates(pool, parsed.data.commissionRate);
    return Response.json({ success: true, barbers });
  } catch (error) {
    console.error("Unable to update commission rates", error);
    return Response.json({ success: false, message: "Unable to update commission rates" }, { status: 500 });
  }
}
