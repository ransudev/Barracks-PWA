"use client";
import { Fragment, useState, type ReactNode } from "react";
import { SelectField } from "@/app/components/ui";
import { useBranchContext } from "@/app/utils/use-branch-context";

export function ReportBranchScope({ globalAllowed = false, children }: { globalAllowed?: boolean; children: (branch: string) => ReactNode }) {
  const { branches, branchId, setBranchId, branchError, branchLoading } = useBranchContext();
  const [global, setGlobal] = useState(globalAllowed);
  const selected = globalAllowed && global ? "all" : String(branchId);
  const ready = !branchLoading && (globalAllowed && global || branchId > 0);
  return <>
    <SelectField label="Branch" value={ready ? selected : ""} onChange={(event) => {
      const value = event.target.value;
      setGlobal(value === "all");
      if (value !== "all") setBranchId(Number(value));
    }}>
      {!ready && <option value="">{branchError ? "Branches unavailable" : branchLoading ? "Loading branches…" : "No assigned branches"}</option>}
      {globalAllowed && <option value="all">All branches (global)</option>}
      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </SelectField>
    {branchError && <p role="alert">{branchError}</p>}
    {ready && <><p>{selected === "all" ? "Global view · All branches" : `Branch view · ${branches.find((branch) => String(branch.id) === selected)?.name ?? ""}`}</p>
      <Fragment key={selected}>{children(selected)}</Fragment></>}
  </>;
}
