import { canManageBooking, type BookingAction } from "@/app/constants/roles";
import { requireRolesUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { bookingEditSchema, bookingUpdateSchema, customerBookingEditSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { BookingServiceError, deleteBooking, findBookingById, updateBooking, updateBookingDetails, type BookingRecord } from "@/server/services/booking.service";
import { findCustomerByUserId } from "@/server/services/customer.service";
import type { PublicUser } from "@/server/services/user.service";

export const runtime = "nodejs";

type AuthorizedBooking = {
  booking: BookingRecord;
  customerId?: number;
};

async function authorizeBookingAction(
  id: number,
  actor: PublicUser,
  action: BookingAction,
): Promise<AuthorizedBooking | Response> {
  const booking = await findBookingById(pool, id);
  if (!booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });

  let customerId: number | undefined;
  if (actor.role === "customer") {
    const customer = await findCustomerByUserId(pool, actor.id);
    if (!customer) return Response.json({ success: false, message: "Customer profile not found" }, { status: 404 });
    customerId = customer.id;
  }

  if (!canManageBooking(actor.role, action, customerId === booking.customerId)) {
    return Response.json({ success: false, message: "You do not have permission to manage this booking" }, { status: 403 });
  }

  return { booking, customerId };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireRolesUser(["administrator", "manager", "front_desk", "customer"]);
  if (actor instanceof Response) return actor;

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
    const authorization = await authorizeBookingAction(
      id,
      actor,
      parsed.data.status === "cancelled" ? "cancel" : "complete",
    );
    if (authorization instanceof Response) return authorization;

    const booking = await updateBooking(
      pool,
      id,
      parsed.data,
      authorization.customerId ? { customerId: authorization.customerId } : undefined,
    );
    if (!booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
    return Response.json({ success: true, booking });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      if (error.kind === "forbidden") return Response.json({ success: false, message: error.message }, { status: 403 });
      if (error.kind === "not_updatable") return Response.json({ success: false, message: error.message }, { status: 409 });
    }
    console.error("Unable to update booking", error);
    return Response.json({ success: false, message: "Unable to update booking" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireRolesUser(["administrator", "manager", "front_desk", "customer"]);
  if (actor instanceof Response) return actor;

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
  const authorization = await authorizeBookingAction(id, actor, "edit");
  if (authorization instanceof Response) return authorization;

  const parsed = actor.role === "customer"
    ? customerBookingEditSchema.safeParse(body)
    : bookingEditSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid booking information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const input = {
      customerId: actor.role === "customer"
        ? authorization.customerId as number
        : Number("customerId" in parsed.data ? parsed.data.customerId : authorization.customerId),
      barberId: parsed.data.barberId,
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      time: parsed.data.time,
    };
    const booking = await updateBookingDetails(
      pool,
      id,
      input,
      authorization.customerId ? { customerId: authorization.customerId } : undefined,
    );
    if (!booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
    return Response.json({ success: true, booking });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      if (error.kind === "forbidden") return Response.json({ success: false, message: error.message }, { status: 403 });
      const status = error.kind === "conflict" || error.kind === "unavailable" || error.kind === "not_updatable" ? 409 : 400;
      return Response.json({ success: false, message: error.message }, { status });
    }
    console.error("Unable to edit booking", error);
    return Response.json({ success: false, message: "Unable to update booking" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireRolesUser(["administrator", "manager", "front_desk", "customer"]);
  if (actor instanceof Response) return actor;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
  }

  try {
    const authorization = await authorizeBookingAction(id, actor, "delete");
    if (authorization instanceof Response) return authorization;

    const deleted = await deleteBooking(pool, id);
    if (!deleted) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
    return Response.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    if (error instanceof BookingServiceError && error.kind === "not_deletable") {
      return Response.json({ success: false, message: error.message }, { status: 409 });
    }
    console.error("Unable to delete booking", error);
    return Response.json({ success: false, message: "Unable to delete booking" }, { status: 500 });
  }
}
