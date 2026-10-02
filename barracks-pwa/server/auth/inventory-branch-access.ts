import type { PoolClient } from "pg";
import { inTransaction, type Db } from "@/server/db/transaction";
import { resolveOperationalBranch, type BranchActor } from "@/server/auth/barber-branch-access";
import { requireBranchAccess } from "@/server/auth/branch-access";
import { BranchError } from "@/server/services/branch.service";

export function inventoryBranch(db: Db, actor: BranchActor, request: Request) {
  return resolveOperationalBranch(db, actor, new URL(request.url).searchParams.get("branchId"));
}

export async function withInventoryOwner<T>(db: Db, actor: BranchActor, request: Request,
  table: "inventory_items" | "restock_requests", id: number, work: (client: PoolClient, branchId: number) => Promise<T>) {
  return inTransaction(db, async (client) => {
    const row = (await client.query<{ branch_id: number }>(`SELECT branch_id FROM ${table} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!row) throw new BranchError(table === "inventory_items" ? "Inventory item not found" : "Restock request not found", 404);
    await requireBranchAccess(client, actor, row.branch_id);
    const raw = new URL(request.url).searchParams.get("branchId");
    if (raw !== null && await resolveOperationalBranch(client, actor, raw) !== row.branch_id)
      throw new BranchError("Record does not belong to the selected branch", 403);
    return work(client, Number(row.branch_id));
  });
}

export function inventoryBranchError(error: unknown): Response | null {
  return error instanceof BranchError
    ? Response.json({ success: false, message: error.message }, { status: error.status }) : null;
}
