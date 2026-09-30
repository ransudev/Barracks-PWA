import { requireAdministrator } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { branchIdSchema, branchPrimarySchema } from "@/server/schemas/branch.schema";
import { mutateAssignment } from "@/server/services/branch.service";
import { branchApiError, branchNotFound, readBranchInput } from "@/server/services/branch-api";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; userId: string }> };
async function mutate(request: Request, context: Context, action: "remove" | "primary") {
  const denied = await requireAdministrator(); if (denied) return denied;
  const params = await context.params;
  const id = branchIdSchema.safeParse(params.id), userId = branchIdSchema.safeParse(params.userId);
  if (!id.success || !userId.success) return branchNotFound();
  if (action === "primary") {
    const input = await readBranchInput(request, branchPrimarySchema); if (input instanceof Response) return input;
  }
  try {
    await mutateAssignment(pool, id.data, userId.data, action);
    return Response.json({ success: true });
  } catch (error) { return branchApiError(error); }
}
export async function PATCH(request: Request, context: Context) { return mutate(request, context, "primary"); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, "remove"); }
