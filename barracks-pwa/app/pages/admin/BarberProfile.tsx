"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials } from "@/app/utils/format";
import { Avatar, Badge, Button, EmptyState, PageHeader, Panel, SectionHeading, SelectField } from "@/app/components/ui";

export function BarberProfile({ go, onToast }: { go: (view: ViewId) => void; onToast: (message: string) => void }) {
  const [items, setItems] = useState<ApiBarber[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/barbers");
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
        if (!response.ok || !body?.success || !body.barbers) throw new Error(body?.message ?? "Unable to load barber profiles");
        setItems(body.barbers);
        setSelectedId((body.barbers[0] && String(body.barbers[0].id)) || "");
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load barber profiles");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const selected = items.find((item) => String(item.id) === selectedId) ?? items[0];
  const name = selected ? `${selected.firstName} ${selected.lastName}` : "Barber profile";
  const status = selected?.status === "available" ? "Available" : selected?.status === "busy" ? "Busy" : "Unavailable";

  return (
    <>
      <PageHeader title="Barber profile" action={<Button variant="secondary" icon="chevronLeft" onClick={() => go("barbers")}>Back to barbers</Button>} />
      {loading ? <Panel><div className="staff-table__empty">Loading barber profiles…</div></Panel> : selected ? (
        <Panel className="profile-view-panel">
          <SectionHeading title="Select a barber" />
          <div className="profile-view__select"><SelectField value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</SelectField></div>
          <div className="profile-view__hero">
            <Avatar initials={createInitials(name)} tone="slate" size="xl" />
            <div><p className="profile-view__eyebrow">Business record</p><h2>{name}</h2><p>{selected.specialty}</p></div>
            <Badge tone={selected.status === "available" ? "success" : selected.status === "busy" ? "warning" : "neutral"}>{status}</Badge>
          </div>
          <div className="profile-view__facts">
            <div><small>Status</small><strong>{status}</strong></div>
            <div><small>Specialty</small><strong>{selected.specialty}</strong></div>
            <div><small>Commission rate</small><strong>{selected.commissionRate === null ? "Not set" : `${selected.commissionRate}%`}</strong></div>
            <div><small>Profile added</small><strong>{new Date(selected.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong></div>
          </div>
        </Panel>
      ) : <Panel><EmptyState icon="scissors" title="No barber profiles" description="Add a barber from the roster to open a profile." /></Panel>}
    </>
  );
}
