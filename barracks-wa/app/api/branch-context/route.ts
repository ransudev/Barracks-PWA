import { requireStaffUser } from "@/server/auth/require-role";
import { getPrimaryBranch, listAccessibleBranches } from "@/server/auth/branch-access";
import { pool } from "@/server/db/pool";
import { branchApiError } from "@/server/services/branch-api";

export const runtime = "nodejs";
export async function GET() {
  const actor = await requireStaffUser(); if (actor instanceof Response) return actor;
  try {
    const [branches, primaryBranch] = await Promise.all([listAccessibleBranches(pool, actor), getPrimaryBranch(pool, actor)]);
    return Response.json({ success: true, branches, primaryBranch });
  } catch (error) { return branchApiError(error); }
}
