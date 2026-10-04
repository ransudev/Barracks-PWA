import { z } from "zod";
import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { listShopHours, listBarberSchedules, listBarberUnavailability } from "@/server/services/schedule.service";

export const runtime = "nodejs";

// Read-only context for staff appointment lookup. Mutation routes retain their guards.
export async function GET(request: Request) {
  const denied = await requireStaff();
  if (denied) return denied;
  const parsed = z.iso.date().safeParse(new URL(request.url).searchParams.get("date"));
  if (!parsed.success) return Response.json({ success: false, message: "Choose a valid date" }, { status: 400 });
  try {
    const date = parsed.data;
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const from = `${date}T00:00:00+08:00`;
    const to = `${next.toISOString().slice(0, 10)}T00:00:00+08:00`;
    const roster = await pool.query<{ id: number }>("SELECT id FROM barbers ORDER BY id");
    const barbers = await Promise.all(roster.rows.map(async ({ id }) => ({
      barberId: id,
      shift: (await listBarberSchedules(pool, id)).find((shift) => shift.dayOfWeek === dayOfWeek) ?? null,
      timeAway: await listBarberUnavailability(pool, id, from, to),
    })));
    let shopHours = null;
    let hoursError = "";
    try { shopHours = (await listShopHours(pool)).find((hour) => hour.dayOfWeek === dayOfWeek) ?? null; }
    catch (cause) { hoursError = cause instanceof Error ? cause.message : "Shop hours unavailable"; }
    return Response.json({ success: true, date, barbers, shopHours, hoursError, timezone: "Asia/Manila" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("Unable to load day schedule", cause);
    return Response.json({ success: false, message: "Unable to load schedule constraints" }, { status: 500 });
  }
}
