"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber, ApiCustomer, ApiInventoryItem } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

export function AdminDashboard({ go, onToast }: { go: (view: ViewId) => void; onToast: (message: string) => void }) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [barberResponse, customerResponse, inventoryResponse] = await Promise.all([apiRequest("/api/barbers"), apiRequest("/api/customers"), apiRequest("/api/inventory")]);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[] }>(customerResponse);
        const inventoryBody = await readApiBody<{ success: boolean; items?: ApiInventoryItem[] }>(inventoryResponse);
        setBarbers(barberBody?.barbers ?? []);
        setCustomers(customerBody?.customers ?? []);
        setInventory(inventoryBody?.items ?? []);
        if (!barberResponse.ok || !customerResponse.ok || !inventoryResponse.ok) throw new Error("Some dashboard data could not be loaded");
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load dashboard");
      }
    }
    void load();
  }, [onToast]);

  const attention = inventory.filter((item) => item.quantity <= item.minimumStock).length;
  return <>
    <PageHeader title="Admin dashboard" action={<Button icon="plus" onClick={() => go("admin-barbers")}>Add barber</Button>} />
    <div className="metrics-grid metrics-grid--four"><MetricCard label="Customer accounts" value={String(customers.length)} icon="users" accent="blue" /><MetricCard label="Total barbers" value={String(barbers.length)} icon="scissors" accent="green" /><MetricCard label="Inventory items" value={String(inventory.length)} icon="box" accent="violet" /><MetricCard label="Stock needing attention" value={String(attention)} icon="info" accent="amber" /></div>
    <Panel className="dashboard-lower-grid"><SectionHeading title="Low-stock items" />{attention ? <div className="admin-dashboard-low-stock">{inventory.filter((item) => item.quantity <= item.minimumStock).map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.category}</small></span><span>{item.quantity} / {item.minimumStock}</span></div>)}</div> : <EmptyState icon="check" title="All stock levels are healthy" description="Items below their minimum will appear here." />}</Panel>
  </>;
}
