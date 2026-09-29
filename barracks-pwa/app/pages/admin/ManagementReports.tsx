"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui";
import { InventoryReports } from "@/app/pages/admin/InventoryReports";
import { RevenueReports } from "@/app/pages/admin/RevenueReports";

export function ManagementReports({ onToast }: { onToast: (message: string) => void }) {
  const [section, setSection] = useState<"sales" | "inventory">("sales");
  return <>
    <div className="panel-toolbar" aria-label="Report type">
      <Button type="button" variant={section === "sales" ? "primary" : "secondary"} onClick={() => setSection("sales")}>Sales & revenue</Button>
      <Button type="button" variant={section === "inventory" ? "primary" : "secondary"} onClick={() => setSection("inventory")}>Inventory reports</Button>
    </div>
    {section === "sales" ? <RevenueReports onToast={onToast} /> : <InventoryReports onToast={onToast} />}
  </>;
}
