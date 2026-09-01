import { requireAdministrator } from "@/server/auth/require-admin";
import { requireStaff, requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberSchema, barberStaffSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { deleteBarber, findBarberById, updateBarber } from "@/server/services/barber.service";

export const runtime = "nodejs";

function parseId(rawId: string): number | null {
  return /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  try {
    const barber = await findBarberById(pool, id);
    if (!barber) return Response.json({ success: false, message: "Barber not found" }, { status: 404 });
    return Response.json({ success: true, barber });
  } catch (error) {
    console.error("Unable to load barber", error);
    return Response.json({ success: false, message: "Unable to load barber" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResult = await requireStaffUser();
  if (authorizationResult instanceof Response) return authorizationResult;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid barber information" }, { status: 400 });
  }
  if (authorizationResult.role !== "administrator" && typeof body === "object" && body !== null && ("rating" in body || "servicesDone" in body)) {
    return Response.json({ success: false, message: "Administrator access is required to change barber ratings or services" }, { status: 403 });
  }
  const parsed = (authorizationResult.role === "administrator" ? barberSchema : barberStaffSchema).safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid barber information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  }
  try {
    const barber = await updateBarber(pool, id, parsed.data);
    if (!barber) return Response.json({ success: false, message: "Barber not found" }, { status: 404 });
    return Response.json({ success: true, barber });
  } catch (error) {
    console.error("Unable to update barber", error);
    return Response.json({ success: false, message: "Unable to update barber" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  try {
    const result = await deleteBarber(pool, id);
    if (result === "not_found") return Response.json({ success: false, message: "Barber not found" }, { status: 404 });
    if (result === "referenced") {
      return Response.json(
        {
          success: false,
          message: "This barber cannot be deleted while bookings reference the profile. Complete or cancel those bookings first.",
        },
        { status: 409 },
      );
    }
    return Response.json({ success: true, message: "Barber deleted" });
  } catch (error) {
    console.error("Unable to delete barber", error);
    return Response.json({ success: false, message: "Unable to delete barber" }, { status: 500 });
  }
}
