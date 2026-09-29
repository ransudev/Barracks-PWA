import { z } from "zod";
import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberStatusSchema } from "@/server/schemas/sprint.schema";
import { updateBarberStatus } from "@/server/services/barber.service";

export const runtime = "nodejs";

const statusUpdateSchema = z.object({ status: barberStatusSchema }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const rawId = (await params).id;
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1)
    return Response.json({ success: false, message: "Invalid barber id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: "Invalid barber status" }, { status: 400 }); }
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid barber status" }, { status: 400 });
  try {
    const barber = await updateBarberStatus(pool, id, parsed.data.status);
    return barber
      ? Response.json({ success: true, barber })
      : Response.json({ success: false, message: "Barber not found" }, { status: 404 });
  } catch (error) {
    console.error("Unable to update barber status", error);
    return Response.json({ success: false, message: "Unable to update barber status" }, { status: 500 });
  }
}
