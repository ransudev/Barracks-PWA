"use client";

import { useState } from "react";
import { ReportBranchScope } from "@/app/components/ReportBranchScope";
import { Button } from "@/app/components/ui";
import { InventoryReports } from "@/app/pages/admin/InventoryReports";
import { RevenueReports } from "@/app/pages/admin/RevenueReports";

export function ManagementReports({ onToast, globalAllowed = false }: { onToast: (message: string) => void; globalAllowed?: boolean }) {
  return <ReportBranchScope globalAllowed={globalAllowed}>{(branch) => <ManagementReportsContent branch={branch} onToast={onToast} />}</ReportBranchScope>;
}
function ManagementReportsContent({ onToast, branch }: { onToast: (message: string) => void; branch: string }) {
  const [section, setSection] = useState<"sales" | "inventory">("sales");
  return <>
    <div className="panel-toolbar management-report-tabs" aria-label="Report type">
      <Button type="button" variant={section === "sales" ? "primary" : "secondary"} onClick={() => setSection("sales")}>Sales & revenue</Button>
      <Button type="button" variant={section === "inventory" ? "primary" : "secondary"} onClick={() => setSection("inventory")}>Inventory reports</Button>
    </div>
    {section === "sales" ? <RevenueReports branch={branch} onToast={onToast} /> : <InventoryReports branch={branch} onToast={onToast} />}
  </>;
}
