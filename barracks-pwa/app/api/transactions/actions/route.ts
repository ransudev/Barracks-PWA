import { z } from "zod";
import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { financialActionSchema } from "@/server/schemas/payment.schema";
import { applyFinancialAction, PaymentServiceError } from "@/server/services/payment.service";

export const runtime = "nodejs";

const requestSchema = financialActionSchema.extend({ reference: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const user = await requireManagementUser();
  if (user instanceof Response) return user;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: "Invalid financial action" }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "A valid full amount and reason are required" }, { status: 400 });
  const { reference, ...input } = parsed.data;
  try {
    return Response.json({ success: true, transaction: await applyFinancialAction(pool, reference, input, user.id) });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return Response.json({ success: false, message: error.message },
        { status: error.kind === "forbidden" ? 403 : error.kind === "not_found" ? 404 : 409 });
    }
    console.error("Unable to apply financial action", error);
    return Response.json({ success: false, message: "Unable to apply financial action" }, { status: 500 });
  }
}
