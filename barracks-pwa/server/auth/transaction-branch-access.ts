import type { PoolClient } from "pg";
import type { BranchActor } from "@/server/auth/barber-branch-access";
import { requireBranchAccess } from "@/server/auth/branch-access";
import { BranchError } from "@/server/services/branch.service";

// Membership mutations lock users too. Acquire this before visit/barber locks
// and keep the current actor's authority stable until the transaction commits.
export async function lockOperationalActor(client: PoolClient, actor?: BranchActor): Promise<BranchActor | undefined> {
  if (!actor) return undefined; // Internal callers; HTTP routes always supply actor.
  const row = (await client.query<{ role: BranchActor["role"] }>(`SELECT r.name AS role FROM users u
    JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.deleted_at IS NULL
    AND u.is_verified AND NOT u.is_blocked FOR SHARE OF u`, [actor.id])).rows[0];
  if (!row || row.role !== "front_desk") throw new BranchError("Front Desk access is required", 403);
  return { id: actor.id, role: row.role };
}

export async function requireTransactionBranch(client: PoolClient, actor: BranchActor | undefined, branchId: number): Promise<void> {
  if (actor) await requireBranchAccess(client, actor, branchId);
}
