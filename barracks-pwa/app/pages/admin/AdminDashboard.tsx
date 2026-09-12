"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber, ApiBooking, ApiCustomer, ApiInventoryItem } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { dateInputValue, formatCurrency } from "@/app/utils/format";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

type DashboardRestock = {
  id: number;
  supplier_name: string;
  status: string;
  reference: string | null;
  received_at: string | null;
  created_at: string;
};

export function AdminDashboard({ go, onToast }: { go: (view: ViewId) => void; onToast: (message: string) => void }) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
  const [restocks, setRestocks] = useState<DashboardRestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [barberResponse, bookingResponse, customerResponse, inventoryResponse, restockResponse] = await Promise.all([
          apiRequest("/api/barbers"),
          apiRequest("/api/bookings"),
          apiRequest("/api/customers"),
          apiRequest("/api/inventory"),
          apiRequest("/api/restocks"),
        ]);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[] }>(bookingResponse);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[] }>(customerResponse);
        const inventoryBody = await readApiBody<{ success: boolean; items?: ApiInventoryItem[] }>(inventoryResponse);
        const restockBody = await readApiBody<{ success: boolean; restocks?: DashboardRestock[] }>(restockResponse);
        if (!barberResponse.ok || !barberBody?.success || !bookingResponse.ok || !bookingBody?.success || !customerResponse.ok || !customerBody?.success || !inventoryResponse.ok || !inventoryBody?.success || !restockResponse.ok || !restockBody?.success) throw new Error("Some dashboard data could not be loaded");
        setBarbers(barberBody.barbers ?? []);
        setBookings(bookingBody.bookings ?? []);
        setCustomers(customerBody.customers ?? []);
        setInventory(inventoryBody.items ?? []);
        setRestocks(restockBody.restocks ?? []);
        setLoadError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load dashboard";
        setLoadError(message);
        onToast(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const attentionItems = inventory.filter((item) => item.status === "active" && item.quantity <= item.minimumStock);
  const attention = attentionItems.length;
  const inventoryValue = inventory.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const pendingRestocks = restocks.filter((restock) => !["Received", "Cancelled"].includes(restock.status));
  const recentDeliveries = restocks.filter((restock) => restock.status === "Received").slice(0, 5);
  const today = dateInputValue();
  const todayBookings = bookings.filter((booking) => booking.date === today && booking.status !== "cancelled").length;
  const upcomingBookings = bookings.filter((booking) => booking.status === "upcoming" && booking.date >= today).length;
  const activeBarbers = barbers.filter((barber) => barber.status !== "unavailable").length;
  const metricValue = (value: number) => loading || loadError ? "—" : String(value);

  return <>
    <PageHeader title="Admin dashboard" action={<Button icon="plus" onClick={() => go("admin-restocks")}>New restock</Button>} />
    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Customer accounts" value={metricValue(customers.length)} icon="users" accent="blue" />
      <MetricCard label="Today’s bookings" value={metricValue(todayBookings)} icon="calendar" accent="amber" />
      <MetricCard label="Upcoming bookings" value={metricValue(upcomingBookings)} icon="clock" accent="violet" />
      <MetricCard label="Active barbers" value={metricValue(activeBarbers)} icon="scissors" accent="green" />
      <MetricCard label="Inventory value" value={loading || loadError ? "—" : formatCurrency(inventoryValue)} icon="box" accent="blue" />
      <MetricCard label="Low / out of stock" value={metricValue(attention)} icon="info" accent="amber" />
      <MetricCard label="Open restocks" value={metricValue(pendingRestocks.length)} icon="calendar" accent="violet" />
      <MetricCard label="Recent deliveries" value={metricValue(recentDeliveries.length)} icon="check" accent="green" />
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
  </>;
}
