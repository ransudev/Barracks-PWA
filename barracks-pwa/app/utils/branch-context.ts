import type { Branch, BranchContext } from "@/app/types/branch";

// Future selectors can keep a preferred ID in component state and reconcile it
// with fresh server context. This is not mounted on operational pages in Phase 1.
export function resolveBranchSelection(context: BranchContext, preferredId: number | null = null): Branch | null {
  return context.branches.find((branch) => branch.id === preferredId)
    ?? context.branches.find((branch) => branch.id === context.primaryBranch?.id)
    ?? context.branches.find((branch) => branch.status === "active")
    ?? context.branches[0]
    ?? null;
}
