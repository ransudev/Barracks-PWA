"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, readApiBody, type ApiBarberAvailability, type ApiQueueEntry } from "@/app/lib/api";
import { Avatar, Badge, Button, EmptyState, MetricCard, PageHeader, Panel, SelectField } from "@/app/components/ui";
import { createInitials } from "@/app/utils/format";

function barberName(barber: ApiBarberAvailability): string {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

export function BarberFloorPage() {
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [queue, setQueue] = useState<ApiQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [barberResponse, queueResponse] = await Promise.all([
        apiRequest("/api/barbers", { cache: "no-store" }),
        apiRequest("/api/queue?view=active", { cache: "no-store" }),
      ]);
      const [barberBody, queueBody] = await Promise.all([
        readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[]; message?: string }>(barberResponse),
        readApiBody<{ success: boolean; queue?: ApiQueueEntry[]; message?: string }>(queueResponse),
      ]);
      if (!barberResponse.ok || !barberBody?.success || !barberBody.barbers) throw new Error(barberBody?.message ?? "Unable to load barbers");
      if (!queueResponse.ok || !queueBody?.success || !queueBody.queue) throw new Error(queueBody?.message ?? "Unable to load the current queue");
      setBarbers(barberBody.barbers);
      setQueue(queueBody.queue);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the barber floor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function changeStatus(barber: ApiBarberAvailability, status: ApiBarberAvailability["status"]) {
    setSavingId(barber.id);
    setStatusError("");
    try {
      const response = await apiRequest(`/api/barbers/${barber.id}/status`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      const body = await readApiBody<{ success: boolean; barber?: ApiBarberAvailability; message?: string }>(response);
      if (!response.ok || !body?.success || !body.barber) throw new Error(body?.message ?? "Unable to update barber status");
      setBarbers((current) => current.map((item) => item.id === barber.id ? body.barber! : item));
    } catch (cause) {
      setStatusError(cause instanceof Error ? cause.message : "Unable to update barber status");
    } finally {
      setSavingId(null);
    }
  }

  const serving = queue.filter((entry) => entry.status === "in_progress" && entry.barberId !== null);
  const available = barbers.filter((barber) => barber.status === "available" && !serving.some((entry) => entry.barberId === barber.id));

  return <div className="operational-workspace">
    <PageHeader title="Barber Floor" description="See current barber availability and assignments." action={<Button icon="refresh" variant="secondary" disabled={loading} onClick={() => void load()}>Refresh</Button>} />
    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Barbers" value={loading ? "—" : String(barbers.length)} icon="scissors" accent="blue" />
      <MetricCard label="Available" value={loading ? "—" : String(available.length)} icon="check" accent="green" />
      <MetricCard label="In service" value={loading ? "—" : String(serving.length)} icon="queue" accent="amber" />
      <MetricCard label="Unavailable" value={loading ? "—" : String(barbers.filter((barber) => barber.status === "unavailable").length)} icon="info" accent="violet" />
    </div>
    <Panel className="operational-panel">
      <div className="inventory-catalog-head"><div><span className="inventory-kicker">Live floor</span><h2>Barber availability</h2><p>Check who is serving and who has a customer ready.</p></div></div>
      {statusError && <p className="operational-loading" role="alert">{statusError}</p>}
      {loading ? <p className="operational-loading" role="status">Loading barber floor…</p>
        : error ? <p className="operational-loading" role="alert">{error}</p>
        : !barbers.length ? <EmptyState icon="scissors" title="No barbers found" description="The roster is managed in the Management workspace." />
        : <div className="barber-status-grid">{barbers.map((barber) => {
          const name = barberName(barber);
          const currentService = serving.find((entry) => entry.barberId === barber.id);
          const readyCount = queue.filter((entry) => entry.barberId === barber.id && entry.status === "ready").length;
          const status = currentService ? "In service" : barber.status === "available" ? "Available" : barber.status === "busy" ? "Busy" : "Unavailable";
          const tone = currentService || barber.status === "busy" ? "warning" : barber.status === "available" ? "success" : "neutral";
          return <article className="barber-status-card" key={barber.id}>
            <div className="barber-status-card__head"><Avatar initials={createInitials(name)} tone="slate" size="md" /><Badge tone={tone}>{status}</Badge></div>
            <strong>{name}</strong>
            <div className="barber-status-card__stats">
              <span><small>Current service</small><strong>{currentService ? `${currentService.customerName} · ${currentService.serviceName}` : "None"}</strong></span>
              <span><small>Ready assignments</small><strong>{readyCount}</strong></span>
            </div>
            <SelectField label="Daily status" aria-label={`Daily status for ${name}`} value={barber.status} disabled={savingId === barber.id}
                onChange={(event) => void changeStatus(barber, event.target.value as ApiBarberAvailability["status"])}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
            </SelectField>
          </article>;
        })}</div>}
    </Panel>
  </div>;
}
