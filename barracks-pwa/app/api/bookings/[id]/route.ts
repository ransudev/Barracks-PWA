import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { bookingEditSchema, bookingUpdateSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { BookingServiceError, updateBooking, updateBookingDetails } from "@/server/services/booking.service";

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
    if (error instanceof BookingServiceError && error.kind === "not_updatable") {
      return Response.json({ success: false, message: error.message }, { status: 409 });
    }
    console.error("Unable to update booking", error);
    return Response.json({ success: false, message: "Unable to update booking" }, { status: 500 });
  }
}

export async function PUT(
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
    return Response.json({ success: false, message: "Invalid booking information" }, { status: 400 });
  }
  const parsed = bookingEditSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid booking information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const booking = await updateBookingDetails(pool, id, parsed.data);
    if (!booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
    return Response.json({ success: true, booking });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      const status = error.kind === "conflict" || error.kind === "unavailable" || error.kind === "not_updatable" ? 409 : 400;
      return Response.json({ success: false, message: error.message }, { status });
    }
    console.error("Unable to edit booking", error);
    return Response.json({ success: false, message: "Unable to update booking" }, { status: 500 });
  }
}
