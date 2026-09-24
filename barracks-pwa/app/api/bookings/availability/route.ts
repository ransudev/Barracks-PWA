import { requireRoles } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { availabilityQuerySchema } from "@/server/schemas/schedule.schema";
import { AvailabilityError, getAnyBarberAvailability, getBookingAvailability } from "@/server/services/booking-availability.service";
import { getCurrentUser } from "@/server/auth/session";
import { findBookingById } from "@/server/services/booking.service";
import { findCustomerByUserId } from "@/server/services/customer.service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const denied = await requireRoles(["customer", "front_desk", "manager", "administrator"]);
  if (denied) return denied;
  const query = new URL(request.url).searchParams;
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(query));
  if (!parsed.success || query.size !== 2 + Number(Boolean(parsed.data?.barberId)) + Number(Boolean(parsed.data?.excludeBookingId))) return Response.json({ success: false, message: "Invalid availability request" }, { status: 400 });
  try {
    if (parsed.data.excludeBookingId) {
      const [actor, booking] = await Promise.all([getCurrentUser(), findBookingById(pool, parsed.data.excludeBookingId)]);
      if (!actor || !booking) return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
      if (actor.role === "customer" && (await findCustomerByUserId(pool, actor.id))?.id !== booking.customerId) {
        return Response.json({ success: false, message: "Booking not found" }, { status: 404 });
      }
    }
    const availability = parsed.data.barberId
      ? await getBookingAvailability(pool, { ...parsed.data, barberId: parsed.data.barberId }, { excludeBookingId: parsed.data.excludeBookingId })
      : await getAnyBarberAvailability(pool, parsed.data, { excludeBookingId: parsed.data.excludeBookingId });
    return Response.json({ success: true, ...availability });
  } catch (error) {
    if (error instanceof AvailabilityError) return Response.json({ success: false, message: error.message }, { status: 404 });
    console.error("Unable to load availability", error);
    return Response.json({ success: false, message: "Unable to load availability" }, { status: 500 });
  }
}
