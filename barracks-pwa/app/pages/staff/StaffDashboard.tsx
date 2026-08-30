"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials } from "@/app/utils/format";
import { Avatar, Badge, Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

function statusLabel(status: ApiBarber["status"]) {
  return status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
}

export function StaffDashboard({ go, onToast }: { go: (view: ViewId) => void; onToast: (message: string) => void }) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/barbers");
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
        if (!response.ok || !body?.success || !body.barbers) throw new Error(body?.message ?? "Unable to load barber dashboard");
        setBarbers(body.barbers);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load barber dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const available = barbers.filter((barber) => barber.status === "available").length;
  const unavailable = barbers.length - available;

  return <>
    <PageHeader title="Barber dashboard" action={<Button icon="plus" onClick={() => go("barbers")}>Manage roster</Button>} />
    <div className="metrics-grid metrics-grid--three"><MetricCard label="Total barbers" value={String(barbers.length)} icon="scissors" accent="blue" /><MetricCard label="Available now" value={String(available)} icon="check" accent="green" /><MetricCard label="Busy or unavailable" value={String(unavailable)} icon="clock" accent="amber" /></div>
    <Panel className="barber-dashboard-panel"><SectionHeading title="Live barber overview" action={<button className="link-button" type="button" onClick={() => go("barber-profile")}>Open profile view <Icon name="arrowRight" size={14} /></button>} /><div className="barber-status-grid">{loading ? <div className="staff-table__empty">Loading barber profiles…</div> : barbers.length ? barbers.map((barber) => <button className="barber-status-card" type="button" key={barber.id} onClick={() => go("barber-profile")}><div className="barber-status-card__head"><Avatar initials={createInitials(`${barber.firstName} ${barber.lastName}`)} tone="slate" size="md" /><Badge tone={barber.status === "available" ? "success" : barber.status === "busy" ? "warning" : "neutral"}>{statusLabel(barber.status)}</Badge></div><strong>{barber.firstName} {barber.lastName}</strong><span>{barber.specialty}</span><div className="barber-status-card__stats"><span><small>Status</small><strong>{statusLabel(barber.status)}</strong></span><span><small>Commission</small><strong>{barber.commissionRate === null ? "—" : `${barber.commissionRate}%`}</strong></span></div></button>) : <EmptyState icon="scissors" title="No barber profiles" description="Add barber records from the roster to populate this overview." />}</div></Panel>
  </>;
}
