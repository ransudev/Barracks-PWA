"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiBarberAvailability, ApiCustomer, ApiQueueEntry } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { Service } from "@/app/types/domain";
import { createInitials } from "@/app/utils/format";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, MetricCard, Modal, PageHeader, Panel, SelectField } from "@/app/components/ui";
import { DetailDrawer, DrawerSection, FilterToolbar, RecordCard, ResponsiveTable, ViewToggle, type OperationalViewMode } from "@/app/components/operations/OperationalPrimitives";

const statusLabel = (status: ApiQueueEntry["status"]) => ({ waiting: "Waiting", ready: "Ready", in_progress: "In progress", completed: "Completed", removed: "Removed" })[status];
const waitMinutes = (entry: ApiQueueEntry) => Math.max(0, Math.floor((Date.now() - new Date(entry.joinedAt).getTime()) / 60_000));

export function QueuePage({ onToast }: { onToast: (message: string) => void }) {
  const [queue, setQueue] = useState<ApiQueueEntry[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [view, setView] = useState<OperationalViewMode>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ApiQueueEntry | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ApiQueueEntry | null>(null);
  const [draft, setDraft] = useState({ customerId: "", serviceId: "", barberId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [queueResponse, customerResponse, serviceResponse, barberResponse] = await Promise.all([
          apiRequest("/api/queue", { cache: "no-store" }), apiRequest("/api/customers", { cache: "no-store" }),
          apiRequest("/api/services", { cache: "no-store" }), apiRequest("/api/barbers", { cache: "no-store" }),
        ]);
        const [queueData, customerData, serviceData, barberData] = await Promise.all([
          readApiBody<{ success: boolean; queue?: ApiQueueEntry[]; message?: string }>(queueResponse),
          readApiBody<{ success: boolean; customers?: ApiCustomer[]; message?: string }>(customerResponse),
          readApiBody<{ success: boolean; services?: Service[]; message?: string }>(serviceResponse),
          readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[]; message?: string }>(barberResponse),
        ]);
        if (!queueResponse.ok || !queueData?.success || !customerResponse.ok || !customerData?.success || !serviceResponse.ok || !serviceData?.success || !barberResponse.ok || !barberData?.success) {
          throw new Error(queueData?.message ?? customerData?.message ?? serviceData?.message ?? barberData?.message ?? "Unable to load queue");
        }
        if (!active) return;
        setQueue(queueData.queue ?? []);
        setCustomers(customerData.customers ?? []);
        setServices(serviceData.services ?? []);
        setBarbers(barberData.barbers ?? []);
        setDraft({ customerId: String(customerData.customers?.[0]?.id ?? ""), serviceId: serviceData.services?.find((service) => service.active)?.id ?? "", barberId: "" });
        setError("");
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Unable to load queue"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => queue.filter((entry) =>
    (statusFilter === "all" || entry.status === statusFilter) &&
    `${entry.customerName} ${entry.serviceName} ${entry.barberName ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [queue, search, statusFilter]);
  const active = queue.filter((entry) => entry.status !== "completed");
  const averageWait = active.length ? Math.round(active.reduce((sum, entry) => sum + waitMinutes(entry), 0) / active.length) : 0;
  const availableBarbers = barbers.filter((barber) => barber.status !== "unavailable");

  async function addWalkIn(event: FormEvent) {
    event.preventDefault();
    if (!draft.customerId || !draft.serviceId) return;
    setBusy(true);
    try {
      const response = await apiRequest("/api/queue", { method: "POST", body: JSON.stringify({ customerId: Number(draft.customerId), serviceId: draft.serviceId, barberId: draft.barberId ? Number(draft.barberId) : null }) });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry; message?: string }>(response);
      if (!response.ok || !body?.success || !body.entry) throw new Error(body?.message ?? "Unable to add walk-in");
      setQueue((current) => [...current, body.entry!]);
      setAddOpen(false);
      onToast("Walk-in added to the queue");
    } catch (cause) { onToast(cause instanceof Error ? cause.message : "Unable to add walk-in"); }
    finally { setBusy(false); }
  }

  async function change(entry: ApiQueueEntry, payload: { barberId: number | null } | { status: ApiQueueEntry["status"] }, remove = false) {
    setBusy(true);
    try {
      const response = await apiRequest(`/api/queue/${entry.id}`, { method: remove ? "DELETE" : "PATCH", body: remove ? undefined : JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry; message?: string }>(response);
      if (!response.ok || !body?.success || !body.entry) throw new Error(body?.message ?? "Unable to update queue");
      setQueue((current) => body.entry!.status === "removed" ? current.filter((item) => item.id !== entry.id) : current.map((item) => item.id === entry.id ? body.entry! : item));
      setSelected(body.entry.status === "removed" ? null : body.entry);
      setPendingRemove(null);
      onToast("Queue updated");
    } catch (cause) { onToast(cause instanceof Error ? cause.message : "Unable to update queue"); }
    finally { setBusy(false); }
  }

  const tone = (status: ApiQueueEntry["status"]) => status === "ready" || status === "completed" ? "success" : status === "in_progress" ? "info" : "neutral";
  const openEntry = (entry: ApiQueueEntry) => setSelected(entry);
  return <div className="operational-workspace">
    <PageHeader title="Queue management" description="Persistent walk-ins and checked-in appointments." action={<><ViewToggle view={view} onChange={setView} label="Choose queue view" /><Button icon="plus" disabled={loading || !customers.length || !services.some((service) => service.active)} onClick={() => setAddOpen(true)}>Add to queue</Button></>} />
    <div className="metrics-grid metrics-grid--three"><MetricCard label="Total in queue" value={String(active.length)} icon="queue" accent="blue" /><MetricCard label="Being served" value={String(active.filter((entry) => entry.status === "in_progress").length)} icon="scissors" accent="amber" /><MetricCard label="Average wait" value={`${averageWait}m`} icon="clock" accent="green" /></div>
    <Panel className="operational-panel"><div className="inventory-catalog-head"><div><span className="inventory-kicker">Live floor</span><h2>Current queue</h2><p>Open an entry to assign a barber or move it forward.</p></div></div>
      <FilterToolbar search={search} onSearchChange={setSearch} placeholder="Search queue" filters={<SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter queue by status"><option value="all">All statuses</option>{(["waiting", "ready", "in_progress", "completed"] as const).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</SelectField>} resultCount={visible.length} />
      {loading ? <p role="status">Loading queue…</p> : error ? <p role="alert">{error}</p> : !visible.length ? <EmptyState icon="queue" title="Queue is empty" description="Check in an appointment or add a walk-in." /> : view === "cards" ?
        <div className="operational-card-grid">{visible.map((entry) => <RecordCard key={entry.id} onOpen={() => openEntry(entry)} ariaLabel={`Open queue entry for ${entry.customerName}`}><div className="operational-card__header"><div className="operational-card__identity"><Avatar initials={createInitials(entry.customerName)} tone="slate" size="md" /><div><strong>{entry.customerName}</strong><small>Queue #{entry.id} · {entry.bookingId ? `Booking #${entry.bookingId}` : "Walk-in"}</small></div></div><Badge tone={tone(entry.status)}>{statusLabel(entry.status)}</Badge></div><p className="operational-card__note">{entry.serviceName} · {entry.barberName ?? "Awaiting barber"}</p><div className="operational-card__facts"><div><span>Joined</span><strong>{new Date(entry.joinedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}</strong></div><div><span>Wait</span><strong>{entry.status === "completed" ? "—" : `${waitMinutes(entry)}m`}</strong></div></div></RecordCard>)}</div> :
        <ResponsiveTable headers={["#", "Customer", "Service", "Barber", "Status", "Wait"]}>{visible.map((entry) => <tr key={entry.id} tabIndex={0} onClick={() => openEntry(entry)} onKeyDown={(event) => { if (event.key === "Enter") openEntry(entry); }}><td>{entry.id}</td><td>{entry.customerName}</td><td>{entry.serviceName}</td><td>{entry.barberName ?? "Unassigned"}</td><td><Badge tone={tone(entry.status)}>{statusLabel(entry.status)}</Badge></td><td>{entry.status === "completed" ? "—" : `${waitMinutes(entry)}m`}</td></tr>)}</ResponsiveTable>}
    </Panel>
    <Modal open={addOpen} title="Add walk-in" description="Choose an existing customer and service." onClose={() => !busy && setAddOpen(false)}><form className="modal-form" onSubmit={addWalkIn}>
      <SelectField label="Customer" required value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}</SelectField>
      <SelectField label="Service" required value={draft.serviceId} onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}>{services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</SelectField>
      <SelectField label="Barber (optional)" value={draft.barberId} onChange={(event) => setDraft({ ...draft, barberId: event.target.value })}><option value="">Unassigned</option>{availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField>
      <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>Add walk-in</Button></div>
    </form></Modal>
    <DetailDrawer open={Boolean(selected)} title={selected?.customerName ?? "Queue entry"} subtitle={selected ? `${selected.serviceName} · Queue #${selected.id}` : undefined} eyebrow="Live queue" onClose={() => setSelected(null)}>
      {selected && <><DrawerSection><div className="operational-drawer__identity"><Avatar initials={createInitials(selected.customerName)} tone="slate" size="lg" /><div><strong>{selected.serviceName}</strong><span>{selected.bookingId ? `Booking #${selected.bookingId}` : "Walk-in"}</span></div><Badge tone={tone(selected.status)}>{statusLabel(selected.status)}</Badge></div></DrawerSection>
        <DrawerSection eyebrow="Assignment" title="Floor handoff"><div className="operational-drawer__rows"><div className="operational-drawer__row"><span>Assigned barber</span>{selected.bookingId === null && ["waiting", "ready"].includes(selected.status) ? <select className="table-select" value={selected.barberId ?? ""} disabled={busy} onChange={(event) => void change(selected, { barberId: event.target.value ? Number(event.target.value) : null })}><option value="">Unassigned</option>{availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</select> : <strong>{selected.barberName ?? "Unassigned"}</strong>}</div></div></DrawerSection>
        {!["completed", "removed"].includes(selected.status) && <DrawerSection eyebrow="Queue actions" title="Move customer forward"><div className="operational-drawer__actions">
          {selected.status === "waiting" && selected.barberId !== null && <Button variant="secondary" disabled={busy} onClick={() => void change(selected, { status: "ready" })}>Mark Ready</Button>}
          {["waiting", "ready"].includes(selected.status) && selected.barberId !== null && <Button disabled={busy} onClick={() => void change(selected, { status: "in_progress" })}>Start Service</Button>}
          {selected.status === "in_progress" && <Button disabled={busy} onClick={() => void change(selected, { status: "completed" })}>Complete</Button>}
          {selected.bookingId === null && ["waiting", "ready"].includes(selected.status) && <Button variant="danger" disabled={busy} onClick={() => setPendingRemove(selected)}>Remove</Button>}
        </div></DrawerSection>}
      </>}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(pendingRemove)} title="Remove this queue entry?" confirmLabel="Remove from queue" danger busy={busy} onClose={() => setPendingRemove(null)} onConfirm={() => pendingRemove && void change(pendingRemove, { status: "removed" }, true)} />
  </div>;
}
