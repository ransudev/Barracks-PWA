import { requireRoles } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { walkInSchema } from "@/server/schemas/queue.schema";
import { addWalkIn, listQueue, QueueServiceError } from "@/server/services/queue.service";

export const runtime = "nodejs";
const staff = ["administrator", "manager", "front_desk"] as const;
export async function GET() {
  const denied = await requireRoles([...staff]);
  if (denied) return denied;
  try { return Response.json({ success: true, queue: await listQueue(pool) }); }
  catch (error) { console.error("Unable to load queue", error); return Response.json({ success: false, message: "Unable to load queue" }, { status: 500 }); }
}
export async function POST(request: Request) {
  const denied = await requireRoles([...staff]);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, message: "Invalid walk-in" }, { status: 400 }); }
  const parsed = walkInSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Choose an existing customer or enter a walk-in name, then choose a service and optional barber" }, { status: 400 });
  try { return Response.json({ success: true, entry: await addWalkIn(pool, parsed.data) }, { status: 201 }); }
  catch (error) {
    if (error instanceof QueueServiceError) return Response.json({ success: false, message: error.message }, { status: error.kind === "conflict" ? 409 : error.kind === "not_found" ? 404 : 400 });
    console.error("Unable to add walk-in", error);
    return Response.json({ success: false, message: "Unable to add walk-in" }, { status: 500 });
  }
}
