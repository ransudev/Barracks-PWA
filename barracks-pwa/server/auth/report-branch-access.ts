import type { Pool } from "pg";
import type { BranchActor } from "@/server/auth/barber-branch-access";
import { listAccessibleBranches, requireBranchAccess } from "@/server/auth/branch-access";
import { BranchError } from "@/server/services/branch.service";

// Missing selection aggregates accessible branches. Only Administrators may
// explicitly request all branches. An empty membership never removes the filter.
export async function resolveReportBranches(db: Pool, actor: BranchActor, raw: string | null): Promise<number[]> {
  if (!["administrator", "manager", "front_desk"].includes(actor.role))
    throw new BranchError("You do not have access to reports", 403);
  if (raw === "all" && actor.role !== "administrator")
    throw new BranchError("Only Administrators can view all branches", 403);
  if (raw !== null && raw !== "all") {
    const id = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) throw new BranchError("Invalid branch", 400);
    await requireBranchAccess(db, actor, id);
    return [id];
  }
  return (await listAccessibleBranches(db, actor)).map((branch) => branch.id);
}

export function requireManagementReport(actor: BranchActor) {
  if (actor.role !== "administrator" && actor.role !== "manager")
    throw new BranchError("You do not have access to reports", 403);
}
