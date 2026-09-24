import { requireManagement } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { weeklyScheduleSchema, unavailabilitySchema } from "@/server/schemas/schedule.schema";
import { addBarberUnavailability, listBarberSchedules, listBarberUnavailability, removeBarberUnavailability, saveBarberSchedule } from "@/server/services/schedule.service";
import { findBarberById } from "@/server/services/barber.service";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function barberId(context: Context): Promise<number | null> { const id = Number((await context.params).id); return Number.isSafeInteger(id) && id > 0 ? id : null; }
export async function GET(_request: Request, context: Context) {
  const denied = await requireManagement(); if (denied) return denied;
  const id = await barberId(context); if (!id) return Response.json({ success: false, message: "Invalid barber" }, { status: 400 });
  try {
    if (!await findBarberById(pool, id)) return Response.json({ success: false, message: "Barber not found" }, { status: 404 });
    return Response.json({ success: true, schedules: await listBarberSchedules(pool, id), unavailability: await listBarberUnavailability(pool, id) });
  } catch (error) { console.error("Unable to load barber schedule", error); return Response.json({ success: false, message: "Unable to load schedule" }, { status: 500 }); }
}
export async function PUT(request: Request, context: Context) {
  const denied = await requireManagement(); if (denied) return denied;
  const id = await barberId(context); if (!id) return Response.json({ success: false, message: "Invalid barber" }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ success: false, message: "Invalid schedule" }, { status: 400 }); }
  const parsed = weeklyScheduleSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid schedule", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { if (!await findBarberById(pool, id)) return Response.json({ success: false, message: "Barber not found" }, { status: 404 }); return Response.json({ success: true, schedules: await saveBarberSchedule(pool, id, parsed.data) }); }
  catch (error) { console.error("Unable to save barber schedule", error); return Response.json({ success: false, message: "Unable to save schedule" }, { status: 500 }); }
}
export async function POST(request: Request, context: Context) {
  const denied = await requireManagement(); if (denied) return denied;
  const id = await barberId(context); if (!id) return Response.json({ success: false, message: "Invalid barber" }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ success: false, message: "Invalid unavailability" }, { status: 400 }); }
  const parsed = unavailabilitySchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid unavailability", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { if (!await findBarberById(pool, id)) return Response.json({ success: false, message: "Barber not found" }, { status: 404 }); return Response.json({ success: true, unavailability: await addBarberUnavailability(pool, id, parsed.data) }, { status: 201 }); }
  catch (error) { console.error("Unable to add unavailability", error); return Response.json({ success: false, message: "Unable to add unavailability" }, { status: 500 }); }
}
export async function DELETE(request: Request, context: Context) {
  const denied = await requireManagement(); if (denied) return denied;
  const id = await barberId(context); const periodId = Number(new URL(request.url).searchParams.get("periodId"));
  if (!id || !Number.isSafeInteger(periodId) || periodId <= 0) return Response.json({ success: false, message: "Invalid period" }, { status: 400 });
  try { const removed = await removeBarberUnavailability(pool, id, periodId); return Response.json({ success: removed, message: removed ? undefined : "Period not found" }, { status: removed ? 200 : 404 }); }
  catch (error) { console.error("Unable to remove unavailability", error); return Response.json({ success: false, message: "Unable to remove unavailability" }, { status: 500 }); }
}
