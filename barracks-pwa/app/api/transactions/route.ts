import { requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { createTransactionSchema } from "@/server/schemas/payment.schema";
import { formatValidationErrors } from "@/server/schemas/user.schema";
import { createTransaction, findTransactionByReference, PaymentServiceError } from "@/server/services/payment.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference || reference.length > 64) return Response.json({ success: false, message: "Valid transaction reference required" }, { status: 400 });
  try {
    const transaction = await findTransactionByReference(pool, reference);
    return transaction
      ? Response.json({ success: true, transaction })
      : Response.json({ success: false, message: "Transaction not found" }, { status: 404 });
  } catch (error) {
    console.error("Unable to load transaction", error);
    return Response.json({ success: false, message: "Unable to load transaction" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireStaffUser();
  if (user instanceof Response) return user;
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: "Invalid payment information" }, { status: 400 }); }
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, message: "Invalid payment information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  try {
    const transaction = await createTransaction(pool, parsed.data, user.id);
    return Response.json({ success: true, transaction }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      const status = error.kind === "forbidden" ? 403 : error.kind === "not_found" ? 404
        : error.kind === "insufficient_cash" ? 422 : 409;
      return Response.json({ success: false, message: error.message }, { status });
    }
    console.error("Unable to create transaction", error);
    return Response.json({ success: false, message: "Unable to create transaction" }, { status: 500 });
  }
}
