import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { bookingUpdateSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { updateBooking } from "@/server/services/booking.service";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid booking update" }, { status: 400 });
  }
  const parsed = bookingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid booking update", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const booking = await updateBooking(pool, id, parsed.data);
    if (!booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
    return Response.json({ success: true, booking });
  } catch (error) {
    console.error("Unable to update booking", error);
    return Response.json({ success: false, message: "Unable to update booking" }, { status: 500 });
  }
}
