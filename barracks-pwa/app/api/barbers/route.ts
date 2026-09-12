import { requireAdministrator } from "@/server/auth/require-admin";
import { requireRolesUser, requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberCommissionSchema, barberSchema, barberStaffSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { createBarber, listBarberAvailability, listBarbers, updateAllBarberCommissionRates } from "@/server/services/barber.service";

export const runtime = "nodejs";

export async function GET() {
  const authorizationResult = await requireRolesUser(["administrator", "front_desk", "customer"]);
  if (authorizationResult instanceof Response) return authorizationResult;
  try {
    const barbers = authorizationResult.role === "customer"
      ? await listBarberAvailability(pool)
      : await listBarbers(pool);
    return Response.json({ success: true, barbers });
  } catch (error) {
    console.error("Unable to list barbers", error);
    return Response.json({ success: false, message: "Unable to load barbers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizationResult = await requireStaffUser();
  if (authorizationResult instanceof Response) return authorizationResult;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid barber information" }, { status: 400 });
  }
  if (authorizationResult.role !== "administrator" && typeof body === "object" && body !== null && ("commissionRate" in body || "rating" in body || "servicesDone" in body)) {
    return Response.json({ success: false, message: "Administrator access is required to set barber commission, ratings, or services" }, { status: 403 });
  }
  const parsed = (authorizationResult.role === "administrator" ? barberSchema : barberStaffSchema).safeParse(body);
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
