import { getCurrentUser } from "@/server/auth/session";
import { requireRoles } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import {
  bookingCreateSchema,
  formatValidationErrors,
} from "@/server/schemas/sprint.schema";
import {
  BookingServiceError,
  createBooking,
  listBookings,
} from "@/server/services/booking.service";
import { findCustomerByUserId } from "@/server/services/customer.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, message: "Authentication is required" }, { status: 401 });
  }
  if (!["administrator", "front_desk", "customer"].includes(user.role)) {
    return Response.json({ success: false, message: "You do not have access to bookings" }, { status: 403 });
  }

  try {
    if (user.role === "customer") {
      const customer = await findCustomerByUserId(pool, user.id);
      if (!customer) return Response.json({ success: false, message: "Customer profile not found" }, { status: 404 });
      return Response.json({ success: true, bookings: await listBookings(pool, customer.id) });
    }
    return Response.json({ success: true, bookings: await listBookings(pool) });
  } catch (error) {
    console.error("Unable to list bookings", error);
    return Response.json({ success: false, message: "Unable to load bookings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizationResponse = await requireRoles(["administrator", "front_desk", "customer"]);
  if (authorizationResponse) return authorizationResponse;

  const user = await getCurrentUser();
  if (!user) return Response.json({ success: false, message: "Authentication is required" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid booking information" }, { status: 400 });
  }

  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid booking information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    let customerId = parsed.data.customerId;
    if (user.role === "customer") {
      const customer = await findCustomerByUserId(pool, user.id);
      if (!customer) return Response.json({ success: false, message: "Customer profile not found" }, { status: 404 });
      customerId = customer.id;
    }
    if (!customerId) {
      return Response.json({ success: false, message: "Choose a customer" }, { status: 400 });
    }

    const booking = await createBooking(pool, { ...parsed.data, customerId });
    return Response.json({ success: true, booking }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      const status = error.kind === "conflict" || error.kind === "unavailable" ? 409 : 400;
      return Response.json({ success: false, message: error.message }, { status });
    }
    console.error("Unable to create booking", error);
    return Response.json({ success: false, message: "Unable to create booking" }, { status: 500 });
  }
}
