import { requireFrontDesk, requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { nextCustomerConfirmSchema } from "@/server/schemas/queue.schema";
import { confirmNextCustomerAssignment, getNextCustomer, QueueServiceError } from "@/server/services/queue.service";

export const runtime = "nodejs";
const noCandidateMessage = "No eligible customer is waiting for this barber.";

export async function GET(request: Request) {
  const denied = await requireStaff();
  if (denied) return denied;
  const barberId = Number(new URL(request.url).searchParams.get("barberId"));
  if (!Number.isSafeInteger(barberId) || barberId < 1)
    return Response.json({ success: false, message: "Choose a barber." }, { status: 400 });
  try {
    const entry = await getNextCustomer(pool, barberId);
    return Response.json({ success: true, entry, message: entry ? null : noCandidateMessage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof QueueServiceError)
      return Response.json({ success: false, message: error.message }, { status: error.kind === "not_found" ? 404 : 409 });
    console.error("Unable to find next customer", error);
    return Response.json({ success: false, message: "Unable to find next customer" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireFrontDesk();
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Choose a barber and suggested customer." }, { status: 400 });
  }
  const parsed = nextCustomerConfirmSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ success: false, message: "Choose a barber and suggested customer." }, { status: 400 });
  try {
    return Response.json({ success: true, entry: await confirmNextCustomerAssignment(pool, parsed.data.barberId, parsed.data.entryId) });
  } catch (error) {
    if (error instanceof QueueServiceError)
      return Response.json({ success: false, message: error.message }, { status: error.kind === "not_found" ? 404 : 409 });
    console.error("Unable to confirm next customer", error);
    return Response.json({ success: false, message: "Unable to confirm next customer" }, { status: 500 });
  }
}
