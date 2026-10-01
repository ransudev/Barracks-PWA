import { requireBranchAccess, listAccessibleBranches } from "@/server/auth/branch-access";
import { resolveOperationalBranch } from "@/server/auth/barber-branch-access";
import { branchApiError } from "@/server/services/branch-api";
import { requireAdministrator, requireManagementUser, requireRolesUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { barberCommissionSchema, barberSchema, barberStaffSchema, formatValidationErrors } from "@/server/schemas/sprint.schema";
import { createBarber, listBarberAvailability, listBarbers, updateAllBarberCommissionRates } from "@/server/services/barber.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationResult = await requireRolesUser(["administrator", "manager", "front_desk", "customer"]);
  if (authorizationResult instanceof Response) return authorizationResult;
  try {
    const actor = authorizationResult;
    const rawBranch = new URL(request.url).searchParams.get("branchId");
    const branchIds = actor.role === "customer" ? undefined
      : rawBranch !== null || actor.role === "front_desk" ? [await resolveOperationalBranch(pool, actor, rawBranch)]
      : actor.role === "administrator" ? undefined : (await listAccessibleBranches(pool, actor)).map((branch) => branch.id);
    const barbers = authorizationResult.role === "customer" || authorizationResult.role === "front_desk"
      ? await listBarberAvailability(pool, branchIds)
      : await listBarbers(pool, branchIds);
    return Response.json({ success: true, barbers });
  } catch (error) {
    return branchApiError(error);
  }
}

export async function POST(request: Request) {
  const actor = await requireManagementUser();
  if (actor instanceof Response) return actor;
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, message: "Invalid barber information" }, { status: 400 });
  }
  const parsed = (actor.role === "administrator" ? barberSchema : barberStaffSchema).safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid barber information", errors: formatValidationErrors(parsed.error) }, { status: 400 });
  }
  try {
    await requireBranchAccess(pool, actor, parsed.data.branchId);
    return Response.json({ success: true, barber: await createBarber(pool, parsed.data) }, { status: 201 });
  } catch (error) {
    return branchApiError(error);
  }
}

export async function PATCH(request: Request) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid commission information" }, { status: 400 });
  }

  const parsed = barberCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid commission information", errors: formatValidationErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const barbers = await updateAllBarberCommissionRates(pool, parsed.data.commissionRate);
    return Response.json({ success: true, barbers });
  } catch (error) {
    console.error("Unable to update commission rates", error);
    return Response.json({ success: false, message: "Unable to update commission rates" }, { status: 500 });
  }
}
