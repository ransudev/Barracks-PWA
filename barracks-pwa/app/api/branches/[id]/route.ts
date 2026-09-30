import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { branchIdSchema, branchUpdateSchema } from "@/server/schemas/branch.schema";
import { updateBranch } from "@/server/services/branch.service";
import { branchApiError, branchNotFound, readBranchInput } from "@/server/services/branch-api";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdministrator(); if (denied) return denied;
  const id = branchIdSchema.safeParse((await params).id); if (!id.success) return branchNotFound();
  const input = await readBranchInput(request, branchUpdateSchema); if (input instanceof Response) return input;
  try {
    const branch = await updateBranch(pool, id.data, input);
    return branch ? Response.json({ success: true, branch }) : branchNotFound();
  } catch (error) { return branchApiError(error); }
}
