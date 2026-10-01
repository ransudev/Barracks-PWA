import type { PublicUser } from "@/server/services/user.service";
import { BranchError } from "@/server/services/branch.service";
import { requireBranchAccess, listAccessibleBranches, getPrimaryBranch } from "@/server/auth/branch-access";
import { inTransaction, type Db } from "@/server/db/transaction";
import type { PoolClient } from "pg";
export type BranchActor = Pick<PublicUser, "id" | "role">;

export async function resolveOperationalBranch(db: Db, actor: BranchActor, rawId: string | null): Promise<number> {
  if (rawId !== null) {
    const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) throw new BranchError("Invalid branch", 400);
    await requireBranchAccess(db, actor, id);
    return id;
  }
  const primary = await getPrimaryBranch(db, actor);
  const branches = await listAccessibleBranches(db, actor);
  const branch = primary ?? branches.find((item) => item.status === "active") ?? branches[0];
  if (!branch) throw new BranchError("No assigned branch is available", 403);
  return branch.id;
}

export async function withAuthorizedBarber<T>(db: Db, actor: BranchActor, id: number, work: (client: PoolClient) => Promise<T>): Promise<T> {
  return inTransaction(db, async (client) => {
    // Keep ownership stable until the read or mutation finishes, including absences.
    const row = (await client.query<{ branch_id: number }>("SELECT branch_id FROM barbers WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!row) throw new BranchError("Barber not found", 404);
    await requireBranchAccess(client, actor, row.branch_id);
    return work(client);
  });
}
