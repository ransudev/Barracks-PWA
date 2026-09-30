import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { branchAssignmentSchema, branchIdSchema } from "@/server/schemas/branch.schema";
import { findBranch, listAssignments, mutateAssignment } from "@/server/services/branch.service";
import { branchApiError, branchNotFound, readBranchInput } from "@/server/services/branch-api";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const denied = await requireAdministrator(); if (denied) return denied;
  const id = branchIdSchema.safeParse((await params).id); if (!id.success) return branchNotFound();
  try {
    if (!await findBranch(pool, id.data)) return branchNotFound();
    return Response.json({ success: true, assignments: await listAssignments(pool, id.data) });
  } catch (error) { return branchApiError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const denied = await requireAdministrator(); if (denied) return denied;
  const id = branchIdSchema.safeParse((await params).id); if (!id.success) return branchNotFound();
  const input = await readBranchInput(request, branchAssignmentSchema); if (input instanceof Response) return input;
  try {
    await mutateAssignment(pool, id.data, input.userId, "assign", input.isPrimary);
    return Response.json({ success: true }, { status: 201 });
  } catch (error) { return branchApiError(error); }
}
