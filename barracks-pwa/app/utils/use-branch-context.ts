"use client";
import { useEffect, useState } from "react";
import type { BranchContext } from "@/app/types/branch";
import { resolveBranchSelection } from "@/app/utils/branch-context";
import { apiRequest, readApiBody } from "@/app/lib/api";

export function useBranchContext() {
  const [context, setContext] = useState<BranchContext>({ branches: [], primaryBranch: null });
  const [branchId, setBranchId] = useState(0);
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchError, setBranchError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await apiRequest("/api/branch-context", { cache: "no-store" });
        const body = await readApiBody<BranchContext & { message?: string }>(response);
        if (!response.ok || !body?.branches) throw new Error(body?.message ?? "Unable to load branches");
        if (active) { setContext(body); setBranchId(resolveBranchSelection(body)?.id ?? 0); }
      } catch (error) { if (active) setBranchError(error instanceof Error ? error.message : "Unable to load branches"); }
      finally { if (active) setBranchLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  return { branches: context.branches, branchId, setBranchId, branchError, branchLoading };
}
