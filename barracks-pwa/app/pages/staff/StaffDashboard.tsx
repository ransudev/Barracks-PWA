"use client";

import { useEffect, useState } from "react";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { createInitials } from "@/app/utils/format";
import { Avatar, Badge, Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

function displayName(barber: ApiBarber) {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

function statusLabel(status: ApiBarber["status"]) {
  return status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
}

function statusTone(status: ApiBarber["status"]): "success" | "warning" | "neutral" {
  return status === "available" ? "success" : status === "busy" ? "warning" : "neutral";
}

function formatAdded(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StaffDashboard({
  go,
  onToast,
}: {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
}) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/barbers");
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
        if (!response.ok || !body?.success || !body.barbers) throw new Error(body?.message ?? "Unable to load barber dashboard");
        setBarbers(body.barbers);
        setSelectedId(body.barbers[0] ? String(body.barbers[0].id) : "");
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
  const selected = barbers.find((barber) => String(barber.id) === selectedId) ?? barbers[0];

  return (
    <>
      <PageHeader title="Barber dashboard" action={<Button icon="plus" onClick={() => go("barbers")}>Manage roster</Button>} />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Total barbers" value={String(barbers.length)} icon="scissors" accent="blue" />
        <MetricCard label="Available now" value={String(available)} icon="check" accent="green" />
        <MetricCard label="Busy or unavailable" value={String(unavailable)} icon="clock" accent="amber" />
      </div>

      <Panel className="barber-dashboard-panel">
        <SectionHeading title="Live barber overview" />
        <div className="barber-status-grid">
          {loading ? (
            <div className="staff-table__empty">Loading barber profiles…</div>
          ) : barbers.length ? (
            barbers.map((barber) => {
              const name = displayName(barber);
              return (
                <button
                  className={`barber-status-card ${selected?.id === barber.id ? "is-selected" : ""}`}
                  type="button"
                  key={barber.id}
                  aria-pressed={selected?.id === barber.id}
                  aria-label={`View ${name} profile`}
                  onClick={() => setSelectedId(String(barber.id))}
                >
                  <div className="barber-status-card__head">
                    <Avatar initials={createInitials(name)} tone="slate" size="md" />
                    <Badge tone={statusTone(barber.status)}>{statusLabel(barber.status)}</Badge>
                  </div>
                  <strong>{name}</strong>
                  <div className="barber-status-card__stats">
                    <span><small>Status</small><strong>{statusLabel(barber.status)}</strong></span>
                    <span><small>Commission</small><strong>{barber.commissionRate === null ? "—" : `${barber.commissionRate}%`}</strong></span>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState icon="scissors" title="No barber profiles" description="Add barber records from the roster to populate this overview." />
          )}
        </div>
      </Panel>

      {selected && (
        <Panel className="barber-profile-summary-panel">
          <SectionHeading title="Barber profile" action={<Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>} />
          <div className="barber-profile-summary__hero">
            <Avatar initials={createInitials(displayName(selected))} tone="slate" size="xl" />
            <div>
              <p className="barber-profile-summary__eyebrow">Business record</p>
              <h2>{displayName(selected)}</h2>
            </div>
          </div>
          <div className="barber-profile-summary__facts">
            <div><small>Status</small><strong>{statusLabel(selected.status)}</strong></div>
            <div><small>Commission rate</small><strong>{selected.commissionRate === null ? "Not set" : `${selected.commissionRate}%`}</strong></div>
            <div><small>Profile added</small><strong>{formatAdded(selected.createdAt)}</strong></div>
          </div>
        </Panel>
      )}
    </>
  );
}
