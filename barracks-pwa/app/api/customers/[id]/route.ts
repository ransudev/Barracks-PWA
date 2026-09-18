import { requireAdministrator } from "@/server/auth/require-admin";
import { requireStaff, requireStaffUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import {
  customerProfileSchema,
  customerStaffProfileSchema,
  formatValidationErrors,
} from "@/server/schemas/sprint.schema";
import { deleteCustomer, findCustomerById, updateCustomer } from "@/server/services/customer.service";

export const runtime = "nodejs";

function parseId(rawId: string): number | null {
  return /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireStaff();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid customer id" }, { status: 400 });

  try {
    const customer = await findCustomerById(pool, id);
    if (!customer) return Response.json({ success: false, message: "Customer not found" }, { status: 404 });
    return Response.json({ success: true, customer });
  } catch (error) {
    console.error("Unable to load customer", error);
    return Response.json({ success: false, message: "Unable to load customer" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResult = await requireStaffUser();
  if (authorizationResult instanceof Response) return authorizationResult;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid customer id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid customer information" }, { status: 400 });
  }
  if (authorizationResult.role !== "administrator" && typeof body === "object" && body !== null && "loyaltyPoints" in body) {
    return Response.json({ success: false, message: "Administrator access is required to change loyalty points" }, { status: 403 });
  }
  const parsed = (authorizationResult.role === "administrator" ? customerProfileSchema : customerStaffProfileSchema).safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid customer information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const customer = await updateCustomer(pool, id, parsed.data);
    if (!customer) return Response.json({ success: false, message: "Customer not found" }, { status: 404 });
    return Response.json({ success: true, customer });
  } catch (error) {
    console.error("Unable to update customer", error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update customer" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;
  const id = parseId((await params).id);
  if (!id) return Response.json({ success: false, message: "Invalid customer id" }, { status: 400 });

  try {
    if (!(await deleteCustomer(pool, id))) {
      return Response.json({ success: false, message: "Customer not found" }, { status: 404 });
    }
    return Response.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    console.error("Unable to delete customer", error);
    return Response.json({ success: false, message: "Unable to delete customer" }, { status: 500 });
  }
}
