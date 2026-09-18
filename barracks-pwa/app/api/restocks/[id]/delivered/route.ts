import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { markRestockDelivered } from "@/server/services/restock.service";

export const runtime = "nodejs";
const parseId = (raw: string) => /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid restock id" }, { status: 400 });

  try {
    return Response.json({ success: true, restock: await markRestockDelivered(pool, id) });
  } catch (error) {
    const message = error instanceof Error && error.message === "INVALID_STATUS_TRANSITION"
      ? "Only shipped restock requests can be marked delivered"
      : "Unable to mark delivery as delivered";
    return Response.json({ success: false, message }, { status: 400 });
  }
}
