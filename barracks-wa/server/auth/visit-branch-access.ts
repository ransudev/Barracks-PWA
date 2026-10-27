import type { Pool, PoolClient } from "pg";
import { resolveOperationalBranch, type BranchActor } from "@/server/auth/barber-branch-access";
import { requireBranchAccess } from "@/server/auth/branch-access";
import { BranchError } from "@/server/services/branch.service";

export async function visitBranch(db: Pool, actor: BranchActor, request: Request): Promise<number> {
  const raw = new URL(request.url).searchParams.get("branchId");
  if (actor.role !== "customer") return resolveOperationalBranch(db, actor, raw);
  return resolveCustomerBranch(db, raw);
}
// Customer selection is separate from staff assignments and branch context.
export async function resolveCustomerBranch(db: Pool | PoolClient, raw: string | null): Promise<number> {
  if (raw !== null && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > 2147483647)) {
    throw new BranchError("Invalid branch", 400);
  }
  const row = (await db.query<{ id: number; status: string }>(
    raw === null ? "SELECT id,status FROM branches WHERE code='MAIN'" : "SELECT id,status FROM branches WHERE id=$1",
    raw === null ? [] : [Number(raw)],
  )).rows[0];
  if (!row || row.status !== "active") throw new BranchError("Choose an active branch", 400);
  return Number(row.id);
}
export async function authorizeVisit(db: Pool, actor: BranchActor, branchId: number) {
  await requireBranchAccess(db, actor, branchId);
}
export function visitBranchError(error: unknown): Response | null {
  if (error instanceof BranchError) return Response.json({ success: false, message: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "23514")
    return Response.json({ success: false, message: "Barber and visit must belong to the same branch" }, { status: 409 });
  return null;
}
