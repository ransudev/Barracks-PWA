import { requireRoles, requireManagement } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { hoursSchema } from "@/server/schemas/schedule.schema";
import { listShopHours, saveShopHours, ShopHoursConfigurationError } from "@/server/services/schedule.service";

export const runtime = "nodejs";
export async function GET() {
  const denied = await requireRoles(["customer", "front_desk", "manager", "administrator"]);
  if (denied) return denied;
  try { return Response.json({ success: true, hours: await listShopHours(pool), timezone: "Asia/Manila" }); }
  catch (error) {
    if (error instanceof ShopHoursConfigurationError) return Response.json({ success: false, message: error.message }, { status: 409 });
    console.error("Unable to load shop hours", error); return Response.json({ success: false, message: "Unable to load shop hours" }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  const denied = await requireManagement();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, message: "Invalid hours" }, { status: 400 }); }
  const parsed = hoursSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid hours", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { return Response.json({ success: true, hours: await saveShopHours(pool, parsed.data) }); }
  catch (error) {
    if (error instanceof ShopHoursConfigurationError) return Response.json({ success: false, message: error.message }, { status: 409 });
    console.error("Unable to save shop hours", error); return Response.json({ success: false, message: "Unable to save shop hours" }, { status: 500 });
  }
}
