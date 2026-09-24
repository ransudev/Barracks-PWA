import { requireRoles } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { availabilityQuerySchema } from "@/server/schemas/schedule.schema";
import { AvailabilityError, getBookingAvailability } from "@/server/services/booking-availability.service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const denied = await requireRoles(["customer", "front_desk", "manager", "administrator"]);
  if (denied) return denied;
  const query = new URL(request.url).searchParams;
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(query));
  if (!parsed.success || query.size !== 3) return Response.json({ success: false, message: "Invalid availability request" }, { status: 400 });
  try {
    const availability = await getBookingAvailability(pool, parsed.data);
    return Response.json({ success: true, ...availability });
  } catch (error) {
    if (error instanceof AvailabilityError) return Response.json({ success: false, message: error.message }, { status: 404 });
    console.error("Unable to load availability", error);
    return Response.json({ success: false, message: "Unable to load availability" }, { status: 500 });
  }
}
