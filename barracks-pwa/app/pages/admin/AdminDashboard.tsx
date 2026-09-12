"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber, ApiBooking, ApiCustomer, ApiInventoryItem } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { dateInputValue } from "@/app/utils/format";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

export function AdminDashboard({ go, onToast }: { go: (view: ViewId) => void; onToast: (message: string) => void }) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [barberResponse, bookingResponse, customerResponse, inventoryResponse] = await Promise.all([apiRequest("/api/barbers"), apiRequest("/api/bookings"), apiRequest("/api/customers"), apiRequest("/api/inventory")]);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[] }>(bookingResponse);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[] }>(customerResponse);
        const inventoryBody = await readApiBody<{ success: boolean; items?: ApiInventoryItem[] }>(inventoryResponse);
        if (!barberResponse.ok || !barberBody?.success || !bookingResponse.ok || !bookingBody?.success || !customerResponse.ok || !customerBody?.success || !inventoryResponse.ok || !inventoryBody?.success) throw new Error("Some dashboard data could not be loaded");
        setBarbers(barberBody?.barbers ?? []);
        setBookings(bookingBody?.bookings ?? []);
        setCustomers(customerBody?.customers ?? []);
        setInventory(inventoryBody?.items ?? []);
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

  const attention = inventory.filter((item) => item.quantity <= item.minimumStock).length;
  const today = dateInputValue();
  const todayBookings = bookings.filter((booking) => booking.date === today && booking.status !== "cancelled").length;
  const upcomingBookings = bookings.filter((booking) => booking.status === "upcoming" && booking.date >= today).length;
  const activeBarbers = barbers.filter((barber) => barber.status !== "unavailable").length;
  const metricValue = (value: number) => loading || loadError ? "—" : String(value);
  return <>
    <PageHeader title="Admin dashboard" action={<Button icon="plus" onClick={() => go("admin-barbers")}>Add barber</Button>} />
    <div className="metrics-grid metrics-grid--four"><MetricCard label="Customer accounts" value={metricValue(customers.length)} icon="users" accent="blue" /><MetricCard label="Today’s bookings" value={metricValue(todayBookings)} icon="calendar" accent="amber" /><MetricCard label="Upcoming bookings" value={metricValue(upcomingBookings)} icon="clock" accent="violet" /><MetricCard label="Active barbers" value={metricValue(activeBarbers)} icon="scissors" accent="green" /><MetricCard label="Inventory items" value={metricValue(inventory.length)} icon="box" accent="violet" /><MetricCard label="Stock needing attention" value={metricValue(attention)} icon="info" accent="amber" /></div>
    <Panel className="dashboard-lower-grid"><SectionHeading title="Low-stock items" />{loadError ? <div className="staff-table__empty">{loadError}</div> : loading ? <div className="staff-table__empty">Loading inventory…</div> : attention ? <div className="admin-dashboard-low-stock">{inventory.filter((item) => item.quantity <= item.minimumStock).map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.category}</small></span><span>{item.quantity} / {item.minimumStock}</span></div>)}</div> : <EmptyState icon="check" title="All stock levels are healthy" description="Items below their minimum will appear here." />}</Panel>
  </>;
}
