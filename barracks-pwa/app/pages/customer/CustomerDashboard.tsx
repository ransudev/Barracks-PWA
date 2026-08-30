"use client";

import { useEffect, useState } from "react";
import type { ApiCustomer, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { Avatar, Button, EmptyState, MetricCard, Panel, SectionHeading } from "@/app/components/ui";
import { createInitials } from "@/app/utils/format";
import { CustomerTopbar } from "@/app/pages/customer/CustomerProfile";

export function CustomerDashboard({ go, onToast, onSignOut, user }: { go: (view: ViewId) => void; onToast: (message: string) => void; onSignOut: () => void; user: ApiUser }) {
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/customers/me");
        const body = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(response);
        if (!response.ok || !body?.success || !body.customer) throw new Error(body?.message ?? "Unable to load customer dashboard");
        setCustomer(body.customer);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load customer dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const name = customer ? `${customer.firstName} ${customer.lastName}` : `${user.firstName} ${user.lastName}`;
  return <div className="customer-page"><CustomerTopbar go={go} active="customer-dashboard" onSignOut={onSignOut} user={user} /><main className="customer-content"><div className="customer-dashboard__heading"><div><p className="customer-page__eyebrow">Customer dashboard</p><h1>Welcome back, {name.split(" ")[0]}.</h1><p>A quiet place to keep your Barracks profile ready for the next visit.</p></div><Button icon="edit" onClick={() => go("customer-profile")}>View profile</Button></div>{loading ? <Panel><div className="staff-table__empty">Loading your dashboard…</div></Panel> : customer ? <><div className="metrics-grid metrics-grid--three"><MetricCard label="Loyalty points" value={String(customer.loyaltyPoints)} icon="spark" accent="amber" /><MetricCard label="Preferred barber" value={customer.preferredBarberName ?? "Not set"} icon="scissors" accent="blue" /><MetricCard label="Account status" value="Active" icon="check" accent="green" /></div><div className="customer-dashboard__grid"><Panel className="customer-summary-panel"><SectionHeading title="Your profile" action={<button className="link-button" type="button" onClick={() => go("customer-profile")}>Edit details</button>} /><div className="customer-summary"><Avatar initials={createInitials(name)} tone="slate" size="lg" /><div><strong>{name}</strong><span>{customer.email}</span><span>{customer.phone || "No phone on file"}</span></div></div></Panel><Panel><SectionHeading title="Visit history" /><EmptyState title="No visits yet" description="Bookings and completed visits will appear here once those systems are connected." /></Panel></div></> : <Panel><EmptyState icon="users" title="Dashboard unavailable" description="Sign out and sign in again to reload your customer account." /></Panel>}</main></div>;
}
