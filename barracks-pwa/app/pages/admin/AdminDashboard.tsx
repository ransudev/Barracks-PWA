"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiUser } from "@/app/lib/api";
import type { ManagementDashboardData } from "@/app/types/dashboard";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

export function AdminDashboard({ go, onToast, currentUser }: { go: (view: ViewId) => void; onToast: (message: string) => void; currentUser: ApiUser }) {
  const [dashboard, setDashboard] = useState<ManagementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiRequest("/api/dashboard/management", { cache: "no-store" });
        const body = await readApiBody<{ success: boolean; dashboard?: ManagementDashboardData; message?: string }>(response);
        if (!response.ok || !body?.success || !body.dashboard) throw new Error(body?.message ?? "Unable to load dashboard");
        if (cancelled) return;
        setDashboard(body.dashboard);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load dashboard";
        setLoadError(message);
        onToast(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onToast]);

  const attentionItems = dashboard?.lowStock ?? [];
  const attention = attentionItems.length;
  const inventoryValue = dashboard?.inventoryValue ?? 0;
  const recentDeliveries = dashboard?.recentDeliveries ?? [];
  const todayBookings = dashboard?.todayBookings ?? 0;
  const upcomingBookings = dashboard?.upcomingBookings ?? 0;
  const activeBarbers = dashboard?.activeBarbers ?? 0;
  const metricValue = (value: number) => loading || loadError ? "—" : String(value);

  const dashboardTitle = currentUser.role === "manager" ? "Manager dashboard" : "Admin dashboard";

  return <div className="admin-dashboard">
    <PageHeader title={dashboardTitle} action={<Button icon="plus" onClick={() => go("admin-restocks")}>New restock</Button>} />
    <div className="admin-dashboard__metric-groups">
      <div className="admin-dashboard__primary-metrics">
        <MetricCard className="metric-card--hero" label="Inventory value" value={loading || loadError ? "—" : formatCurrency(inventoryValue)} icon="box" accent="blue" />
        <MetricCard label="Low / out of stock" value={metricValue(attention)} icon="info" accent="amber" />
        <MetricCard label="Open restocks" value={metricValue(dashboard?.openRestocks ?? 0)} icon="calendar" accent="violet" />
      </div>
      <div className="admin-dashboard__supporting-metrics">
        <MetricCard label="Today’s bookings" value={metricValue(todayBookings)} icon="calendar" accent="amber" />
        <MetricCard label="Upcoming bookings" value={metricValue(upcomingBookings)} icon="clock" accent="violet" />
        <MetricCard label="Active barbers" value={metricValue(activeBarbers)} icon="scissors" accent="green" />
        <MetricCard label="Customer accounts" value={metricValue(dashboard?.customerCount ?? 0)} icon="users" accent="blue" />
      </div>
    </div>

    <div className="dashboard-lower-grid">
      <Panel>
        <SectionHeading title="Low-stock items" action={<Button size="sm" variant="secondary" onClick={() => go("admin-inventory")}>Open inventory</Button>} />
        {loadError ? <div className="staff-table__empty">{loadError}</div> : loading ? <div className="staff-table__empty">Loading inventory…</div> : attention ? <div className="admin-dashboard-low-stock">{attentionItems.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.supplierName ?? "No supplier"} · {item.category}</small></span><span>{item.quantity} / {item.minimumStock} {item.unit}</span></div>)}</div> : <EmptyState icon="check" title="All stock levels are healthy" description="Items below their minimum will appear here." />}
      </Panel>
      <Panel>
        <SectionHeading title="Recent deliveries" action={<Button size="sm" variant="secondary" onClick={() => go("admin-restocks")}>Open restocks</Button>} />
        {loading ? <div className="staff-table__empty">Loading deliveries…</div> : recentDeliveries.length ? <div className="admin-dashboard-low-stock">{recentDeliveries.map((restock) => <div key={restock.id}><span><strong>{restock.supplier_name}</strong><small>Request #{restock.id} · {restock.reference ?? "No reference"}</small></span><span>{restock.received_at ? new Date(restock.received_at).toLocaleDateString() : "Received"}</span></div>)}</div> : <EmptyState icon="box" title="No deliveries received yet" description="Confirmed supplier deliveries will appear here." />}
      </Panel>
    </div>
  </div>;
}
