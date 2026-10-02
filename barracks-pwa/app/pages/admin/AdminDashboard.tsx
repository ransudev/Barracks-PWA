"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiUser } from "@/app/lib/api";
import type { DashboardReport } from "@/server/services/dashboard-report.service";
import { ReportBranchScope } from "@/app/components/ReportBranchScope";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

type DashboardProps = { go: (view: ViewId) => void; onToast: (message: string) => void; currentUser: ApiUser };

export function AdminDashboard(props: DashboardProps) {
  return <ReportBranchScope globalAllowed={props.currentUser.role === "administrator"}>
    {(branch) => <AdminDashboardContent {...props} branch={branch} />}
  </ReportBranchScope>;
}

function AdminDashboardContent({ go, onToast, currentUser, branch }: DashboardProps & { branch: string }) {
  const [data, setData] = useState<DashboardReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await apiRequest(`/api/reports/dashboard?branchId=${branch}`, { cache: "no-store" });
        const body = await readApiBody<DashboardReport & { success: boolean; message?: string }>(response);
        if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load dashboard");
        if (active) { setData(body); setLoadError(""); }
      } catch (error) {
        if (active) { const message = error instanceof Error ? error.message : "Unable to load dashboard"; setLoadError(message); onToast(message); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [branch, onToast]);
  const attentionItems = data?.attentionItems ?? [];
  const recentDeliveries = data?.recentDeliveries ?? [];
  const attention = data?.lowStock ?? 0;
  const inventoryValue = data?.inventoryValue ?? 0;
  const metricValue = (value?: number) => loading || loadError ? "—" : String(value ?? 0);

  const dashboardTitle = currentUser.role === "manager" ? "Manager dashboard" : "Admin dashboard";

  return <div className="admin-dashboard">
    <PageHeader title={dashboardTitle} action={<Button icon="plus" onClick={() => go("admin-restocks")}>New restock</Button>} />
    <div className="admin-dashboard__metric-groups">
      <div className="admin-dashboard__primary-metrics">
        <MetricCard className="metric-card--hero" label="Inventory value" value={loading || loadError ? "—" : formatCurrency(inventoryValue)} icon="box" accent="blue" />
        <MetricCard label="Low / out of stock" value={metricValue(attention)} icon="info" accent="amber" />
        <MetricCard label="Open restocks" value={metricValue(data?.openRestocks)} icon="calendar" accent="violet" />
      </div>
      <div className="admin-dashboard__supporting-metrics">
        <MetricCard label="Today’s bookings" value={metricValue(data?.todayBookings)} icon="calendar" accent="amber" />
        <MetricCard label="Upcoming bookings" value={metricValue(data?.upcomingBookings)} icon="clock" accent="violet" />
        <MetricCard label="Active barbers" value={metricValue(data?.activeBarbers)} icon="scissors" accent="green" />
        <MetricCard label="Customers with visits" value={metricValue(data?.customers)} icon="users" accent="blue" />
      </div>
    </div>

    <div className="dashboard-lower-grid">
      <Panel>
        <SectionHeading title="Low-stock items" action={<Button size="sm" variant="secondary" onClick={() => go("admin-inventory")}>Open inventory</Button>} />
        {loadError ? <div className="staff-table__empty">{loadError}</div> : loading ? <div className="staff-table__empty">Loading inventory…</div> : attention ? <div className="admin-dashboard-low-stock">{attentionItems.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.supplierName ?? "No supplier"} · {item.category}</small></span><span>{item.quantity} / {item.minimumStock} {item.unit}</span></div>)}</div> : <EmptyState icon="check" title="All stock levels are healthy" description="Items below their minimum will appear here." />}
      </Panel>
      <Panel>
        <SectionHeading title="Recent deliveries" action={<Button size="sm" variant="secondary" onClick={() => go("admin-restocks")}>Open restocks</Button>} />
        {loadError ? <div className="staff-table__empty">{loadError}</div> : loading ? <div className="staff-table__empty">Loading deliveries…</div> : recentDeliveries.length ? <div className="admin-dashboard-low-stock">{recentDeliveries.map((restock) => <div key={restock.id}><span><strong>{restock.supplier_name}</strong><small>Request #{restock.id} · {restock.reference ?? "No reference"}</small></span><span>{restock.received_at ? new Date(restock.received_at).toLocaleDateString() : "Received"}</span></div>)}</div> : <EmptyState icon="box" title="No deliveries received yet" description="Confirmed supplier deliveries will appear here." />}
      </Panel>
    </div>
  </div>;
}
