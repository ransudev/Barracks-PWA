import { requireAdministrator, requireManagement, requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { deleteBarber, findBarberById, updateBarber } from "@/server/services/barber.service";

export const runtime = "nodejs";

function parseId(rawId: string): number | null {
  return /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaffUser();
  if (actor instanceof Response) return actor;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  try {
    const barber = await findBarberById(pool, id);
    if (!barber) return Response.json({ success: false, message: "Barber not found" }, { status: 404 });
    return Response.json({ success: true, barber: actor.role === "front_desk"
      ? { id: barber.id, firstName: barber.firstName, lastName: barber.lastName, status: barber.status }
      : barber });
  } catch (error) {
    console.error("Unable to load barber", error);
    return Response.json({ success: false, message: "Unable to load barber" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireManagement();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid barber information" }, { status: 400 });
  }
  const parsed = barberSchema.safeParse(body);
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
          message: "This barber cannot be deleted while linked records, including bookings or attendance history, reference the profile.",
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
