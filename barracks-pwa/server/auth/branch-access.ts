import type { Pool, PoolClient } from "pg";
import type { PublicUser } from "@/server/services/user.service";
import { BranchError, findBranch, listBranches, listAssignedBranches } from "@/server/services/branch.service";
import type { Branch } from "@/app/types/branch";

type Db = Pool | PoolClient;
type Actor = Pick<PublicUser, "id" | "role">;
export const isBranchStaff = (role: string) => role === "manager" || role === "front_desk";

// Membership includes active and inactive branches. Phase 2 uses these checks
// for barbers and scheduling; activation policies remain deferred.
export async function listAccessibleBranches(db: Db, actor: Actor): Promise<Branch[]> {
  if (actor.role === "administrator") return listBranches(db);
  if (!isBranchStaff(actor.role)) return [];
  return listAssignedBranches(db, actor.id);
}
export async function checkBranchAccess(db: Db, actor: Actor, branchId: number): Promise<boolean> {
  if (actor.role !== "administrator" && !isBranchStaff(actor.role)) return false;
  return Boolean((await db.query(`SELECT 1 FROM branches b WHERE b.id=$1
    AND ($2::boolean OR EXISTS (SELECT 1 FROM user_branches ub WHERE ub.user_id=$3 AND ub.branch_id=b.id))`,
    [branchId, actor.role === "administrator", actor.id])).rowCount);
}
export async function requireBranchAccess(db: Db, actor: Actor, branchId: number): Promise<void> {
  if (!await checkBranchAccess(db, actor, branchId)) throw new BranchError("You do not have access to this branch", 403);
}
export async function getPrimaryBranch(db: Db, actor: Actor): Promise<Branch | null> {
  if (!isBranchStaff(actor.role)) return null;
  const row = (await db.query<{ branch_id: number }>("SELECT branch_id FROM user_branches WHERE user_id=$1 AND is_primary", [actor.id])).rows[0];
  return row ? findBranch(db, row.branch_id) : null;
}
