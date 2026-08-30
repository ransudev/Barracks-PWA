import { requireStaff } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import {
  customerSignupSchema,
  formatValidationErrors,
} from "@/server/schemas/sprint.schema";
import { createCustomer, listCustomers } from "@/server/services/customer.service";

export const runtime = "nodejs";

export async function GET() {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;

  try {
    return Response.json({ success: true, customers: await listCustomers(pool) });
  } catch (error) {
    console.error("Unable to list customers", error);
    return Response.json({ success: false, message: "Unable to load customers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid customer information" }, { status: 400 });
  }

  const parsed = customerSignupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Invalid customer information",
        errors: formatValidationErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const result = await createCustomer(pool, parsed.data);
    if (result.kind === "duplicate") {
      return Response.json(
        { success: false, message: "A customer with this email already exists" },
        { status: 409 },
      );
    }
    return Response.json({ success: true, customer: result.customer }, { status: 201 });
  } catch (error) {
    console.error("Unable to create customer", error);
    return Response.json({ success: false, message: "Unable to create customer" }, { status: 500 });
  }
}
