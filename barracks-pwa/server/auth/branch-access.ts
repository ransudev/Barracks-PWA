import type { Pool, PoolClient } from "pg";
import type { PublicUser } from "@/server/services/user.service";
import { BranchError, findBranch, listBranches } from "@/server/services/branch.service";
import type { Branch } from "@/app/types/branch";

type Db = Pool | PoolClient;
type Actor = Pick<PublicUser, "id" | "role">;
export const isBranchStaff = (role: string) => role === "manager" || role === "front_desk";

// Membership includes active and inactive branches. Phase 2 uses these checks
// for barbers and scheduling; activation policies remain deferred.
export async function listAccessibleBranches(db: Db, actor: Actor): Promise<Branch[]> {
  if (actor.role === "administrator") return listBranches(db);
  if (!isBranchStaff(actor.role)) return [];
  const memberships = await db.query<{ branch_id: number }>("SELECT branch_id FROM user_branches WHERE user_id=$1", [actor.id]);
  const ids = new Set(memberships.rows.map((row) => row.branch_id));
  return (await listBranches(db)).filter((branch) => ids.has(branch.id));
}
export async function checkBranchAccess(db: Db, actor: Actor, branchId: number): Promise<boolean> {
  if (actor.role !== "administrator" && !isBranchStaff(actor.role)) return false;
  if (!await findBranch(db, branchId)) return false;
  if (actor.role === "administrator") return true;
  return Boolean((await db.query("SELECT 1 FROM user_branches WHERE user_id=$1 AND branch_id=$2", [actor.id, branchId])).rowCount);
}
export async function requireBranchAccess(db: Db, actor: Actor, branchId: number): Promise<void> {
  if (!await checkBranchAccess(db, actor, branchId)) throw new BranchError("You do not have access to this branch", 403);
}
export async function getPrimaryBranch(db: Db, actor: Actor): Promise<Branch | null> {
  if (!isBranchStaff(actor.role)) return null;
  const row = (await db.query<{ branch_id: number }>("SELECT branch_id FROM user_branches WHERE user_id=$1 AND is_primary", [actor.id])).rows[0];
  return row ? findBranch(db, row.branch_id) : null;
}
