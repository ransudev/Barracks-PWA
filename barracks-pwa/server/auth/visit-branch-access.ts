import type { Pool } from "pg";
import { resolveOperationalBranch, type BranchActor } from "@/server/auth/barber-branch-access";
import { requireBranchAccess } from "@/server/auth/branch-access";
import { BranchError } from "@/server/services/branch.service";

export async function visitBranch(db: Pool, actor: BranchActor, request: Request): Promise<number> {
  const raw = new URL(request.url).searchParams.get("branchId");
  if (actor.role !== "customer") return resolveOperationalBranch(db, actor, raw);
  const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
  if (raw !== null && raw !== String(main)) throw new BranchError("Customer bookings use Main Branch", 403);
  return main;
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
