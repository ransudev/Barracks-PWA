"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ApiBarberAvailability, ApiCustomer, ApiQueueEntry } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { Service } from "@/app/types/domain";
import { createInitials } from "@/app/utils/format";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, MetricCard, Modal, PageHeader, Panel, SelectField, TextField } from "@/app/components/ui";
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
  const [nextBarberId, setNextBarberId] = useState("");
  const [nextEntry, setNextEntry] = useState<ApiQueueEntry | null>(null);
  const [nextMessage, setNextMessage] = useState("");
  const [nextBusy, setNextBusy] = useState(false);
  const [draft, setDraft] = useState({ customerId: "", serviceId: "", barberId: "" });
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", phone: "" });
  const submissionKey = useRef<string | null>(null);
  const addInFlight = useRef(false);
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

  function openAddDialog() {
    setDraft({
      customerId: customers[0] ? String(customers[0].id) : "new",
      serviceId: services.find((service) => service.active)?.id ?? "",
      barberId: "",
    });
    setNewCustomer({ firstName: "", lastName: "", phone: "" });
    submissionKey.current = globalThis.crypto.randomUUID();
    setAddOpen(true);
  }

  function closeAddDialog() {
    if (addInFlight.current) return;
    submissionKey.current = null;
    setAddOpen(false);
  }

  async function addWalkIn(event: FormEvent) {
    event.preventDefault();
    if (addInFlight.current || !draft.customerId || !draft.serviceId) return;
    addInFlight.current = true;
    const idempotencyKey = submissionKey.current ?? globalThis.crypto.randomUUID();
    submissionKey.current = idempotencyKey;
    setBusy(true);
    try {
      const payload = {
        ...(draft.customerId === "new"
          ? { customer: { firstName: newCustomer.firstName, lastName: newCustomer.lastName, phone: newCustomer.phone } }
          : { customerId: Number(draft.customerId) }),
        serviceId: draft.serviceId,
        barberId: draft.barberId ? Number(draft.barberId) : null,
        idempotencyKey,
      };
      const response = await apiRequest("/api/queue", { method: "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry; message?: string }>(response);
      if (!response.ok || !body?.success || !body.entry) throw new Error(body?.message ?? "Unable to add walk-in");
      setQueue((current) => [...current, body.entry!]);
      setNextEntry(null);
      setNextMessage("");
      submissionKey.current = null;
      setAddOpen(false);
      onToast("Walk-in added to the queue");
      if (draft.customerId === "new") {
        try {
          const customerResponse = await apiRequest("/api/customers", { cache: "no-store" });
          const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[] }>(customerResponse);
          if (customerResponse.ok && customerBody?.success && customerBody.customers) setCustomers(customerBody.customers);
        } catch { /* The queue entry is already committed; reload customers next time. */ }
      }
    } catch (cause) { onToast(cause instanceof Error ? cause.message : "Unable to add walk-in"); }
    finally { addInFlight.current = false; setBusy(false); }
  }

  async function change(entry: ApiQueueEntry, payload: { barberId: number | null } | { status: ApiQueueEntry["status"] }, remove = false) {
    setBusy(true);
    try {
      const response = await apiRequest(`/api/queue/${entry.id}`, { method: remove ? "DELETE" : "PATCH", body: remove ? undefined : JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry; message?: string }>(response);
      if (!response.ok || !body?.success || !body.entry) throw new Error(body?.message ?? "Unable to update queue");
      setQueue((current) => body.entry!.status === "removed" ? current.filter((item) => item.id !== entry.id) : current.map((item) => item.id === entry.id ? body.entry! : item));
      setNextEntry(null);
      setNextMessage("");
      setSelected(body.entry.status === "removed" ? null : body.entry);
      setPendingRemove(null);
      onToast("Queue updated");
    } catch (cause) { onToast(cause instanceof Error ? cause.message : "Unable to update queue"); }
    finally { setBusy(false); }
  }

  async function suggestNext() {
    if (!nextBarberId) return;
    setNextBusy(true);
    setNextEntry(null);
    setNextMessage("");
    try {
      const response = await apiRequest(`/api/queue/next?barberId=${nextBarberId}`, { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry | null; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to find next customer");
      setNextEntry(body.entry ?? null);
      if (!body.entry) setNextMessage(body.message ?? "No eligible customer is waiting for this barber.");
    } catch (cause) { setNextMessage(cause instanceof Error ? cause.message : "Unable to find next customer"); }
    finally { setNextBusy(false); }
  }

  async function confirmNextAssignment() {
    if (!nextEntry || !nextBarberId || nextEntry.status !== "waiting") return;
    setNextBusy(true);
    try {
      const response = await apiRequest("/api/queue/next", { method: "POST", body: JSON.stringify({ barberId: Number(nextBarberId), entryId: nextEntry.id }) });
      const body = await readApiBody<{ success: boolean; entry?: ApiQueueEntry; message?: string }>(response);
      if (!response.ok || !body?.success || !body.entry) throw new Error(body?.message ?? "Unable to assign next customer");
      setQueue((current) => current.map((entry) => entry.id === body.entry!.id ? body.entry! : entry));
      setNextEntry(body.entry);
      setNextMessage("");
      setSelected(body.entry);
      onToast("Barber assigned. Start service when ready.");
    } catch (cause) {
      setNextEntry(null);
      setNextMessage(cause instanceof Error ? cause.message : "Unable to assign next customer");
    } finally { setNextBusy(false); }
  }

  const tone = (status: ApiQueueEntry["status"]) => status === "ready" || status === "completed" ? "success" : status === "in_progress" ? "info" : "neutral";
  const openEntry = (entry: ApiQueueEntry) => setSelected(entry);
  return <div className="operational-workspace">
    <PageHeader title="Queue management" description="Persistent walk-ins and checked-in appointments." action={<><ViewToggle view={view} onChange={setView} label="Choose queue view" /><Button icon="plus" disabled={loading || !services.some((service) => service.active)} onClick={openAddDialog}>Add to queue</Button></>} />
    <div className="metrics-grid metrics-grid--three"><MetricCard label="Total in queue" value={String(active.length)} icon="queue" accent="blue" /><MetricCard label="Being served" value={String(active.filter((entry) => entry.status === "in_progress").length)} icon="scissors" accent="amber" /><MetricCard label="Average wait" value={`${averageWait}m`} icon="clock" accent="green" /></div>
    <Panel className="queue-next-panel"><div className="inventory-catalog-head"><div><span className="inventory-kicker">Front desk</span><h2>Next Customer</h2><p>Choose an available barber, then review the suggested customer.</p></div></div>
      <div className="queue-next__body"><div className="queue-next__controls">
        <SelectField label="Barber" value={nextBarberId} disabled={nextBusy} onChange={(event) => { setNextBarberId(event.target.value); setNextEntry(null); setNextMessage(""); }}><option value="">Select barber</option>{availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField>
        <Button type="button" size="sm" disabled={!nextBarberId || nextBusy || loading} onClick={() => void suggestNext()}>{nextBusy ? "Checking…" : "Next Customer"}</Button>
      </div>
      {nextMessage && <p className="queue-next__message" role="status">{nextMessage}</p>}
      {nextEntry && <div className="queue-next__suggestion" role="region" aria-label="Suggested next customer">
        <div><strong>{nextEntry.customerName}</strong><span>{nextEntry.serviceName} · {nextEntry.bookingId === null ? "Walk-in" : `Appointment #${nextEntry.bookingId}`}</span></div>
        <dl><div><dt>Joined / checked in</dt><dd>{new Date(nextEntry.joinedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</dd></div><div><dt>Current barber</dt><dd>{nextEntry.barberName ?? "Unassigned"}</dd></div></dl>
        {nextEntry.status === "waiting" ? <Button type="button" size="sm" disabled={nextBusy} onClick={() => void confirmNextAssignment()}>Assign barber</Button> : <Button type="button" size="sm" variant="secondary" onClick={() => setSelected(nextEntry)}>Open queue entry</Button>}
      </div>}
      </div>
    </Panel>
    <Panel className="operational-panel"><div className="inventory-catalog-head"><div><span className="inventory-kicker">Live floor</span><h2>Current queue</h2><p>Open an entry to assign a barber or move it forward.</p></div></div>
      <FilterToolbar search={search} onSearchChange={setSearch} placeholder="Search queue" filters={<SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter queue by status"><option value="all">All statuses</option>{(["waiting", "ready", "in_progress", "completed"] as const).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</SelectField>} resultCount={visible.length} />
      {loading ? <p role="status">Loading queue…</p> : error ? <p role="alert">{error}</p> : !visible.length ? <EmptyState icon="queue" title="Queue is empty" description="Check in an appointment or add a walk-in." /> : view === "cards" ?
        <div className="operational-card-grid">{visible.map((entry) => <RecordCard key={entry.id} onOpen={() => openEntry(entry)} ariaLabel={`Open queue entry for ${entry.customerName}`}><div className="operational-card__header"><div className="operational-card__identity"><Avatar initials={createInitials(entry.customerName)} tone="slate" size="md" /><div><strong>{entry.customerName}</strong><small>Queue #{entry.id} · {entry.bookingId ? `Booking #${entry.bookingId}` : "Walk-in"}</small></div></div><Badge tone={tone(entry.status)}>{statusLabel(entry.status)}</Badge></div><p className="operational-card__note">{entry.serviceName} · {entry.barberName ?? "Awaiting barber"}</p><div className="operational-card__facts"><div><span>Joined</span><strong>{new Date(entry.joinedAt).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}</strong></div><div><span>Wait</span><strong>{entry.status === "completed" ? "—" : `${waitMinutes(entry)}m`}</strong></div></div></RecordCard>)}</div> :
        <ResponsiveTable headers={["#", "Customer", "Service", "Barber", "Status", "Wait"]}>{visible.map((entry) => <tr key={entry.id} tabIndex={0} onClick={() => openEntry(entry)} onKeyDown={(event) => { if (event.key === "Enter") openEntry(entry); }}><td>{entry.id}</td><td>{entry.customerName}</td><td>{entry.serviceName}</td><td>{entry.barberName ?? "Unassigned"}</td><td><Badge tone={tone(entry.status)}>{statusLabel(entry.status)}</Badge></td><td>{entry.status === "completed" ? "—" : `${waitMinutes(entry)}m`}</td></tr>)}</ResponsiveTable>}
    </Panel>
    <Modal open={addOpen} title="Add to queue" description="Choose an existing customer or add a walk-in record." onClose={closeAddDialog}><form className="modal-form" onSubmit={addWalkIn}>
      <SelectField label="Customer" required disabled={busy} value={draft.customerId} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setDraft({ ...draft, customerId: event.target.value }); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}<option value="new">New Walk-In Customer</option></SelectField>
      {draft.customerId === "new" && <><TextField label="First name" required disabled={busy} autoComplete="given-name" value={newCustomer.firstName} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setNewCustomer((current) => ({ ...current, firstName: event.target.value })); }} /><TextField label="Last name" required disabled={busy} autoComplete="family-name" value={newCustomer.lastName} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setNewCustomer((current) => ({ ...current, lastName: event.target.value })); }} /><TextField label="Phone number (optional)" type="tel" inputMode="tel" maxLength={11} disabled={busy} value={newCustomer.phone} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setNewCustomer((current) => ({ ...current, phone: event.target.value })); }} /></>}
      <SelectField label="Service" required disabled={busy} value={draft.serviceId} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setDraft({ ...draft, serviceId: event.target.value }); }}>{services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</SelectField>
      <SelectField label="Barber (optional)" disabled={busy} value={draft.barberId} onChange={(event) => { submissionKey.current = globalThis.crypto.randomUUID(); setDraft({ ...draft, barberId: event.target.value }); }}><option value="">Unassigned</option>{availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField>
      <div className="modal-actions"><Button variant="secondary" type="button" disabled={busy} onClick={closeAddDialog}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add to queue"}</Button></div>
    </form></Modal>
    <DetailDrawer open={Boolean(selected)} title={selected?.customerName ?? "Queue entry"} subtitle={selected ? `${selected.serviceName} · Queue #${selected.id}` : undefined} eyebrow="Live queue" onClose={() => setSelected(null)}>
      {selected && <><DrawerSection><div className="operational-drawer__identity"><Avatar initials={createInitials(selected.customerName)} tone="slate" size="lg" /><div><strong>{selected.serviceName}</strong><span>{selected.bookingId ? `Booking #${selected.bookingId}` : "Walk-in"}</span></div><Badge tone={tone(selected.status)}>{statusLabel(selected.status)}</Badge></div></DrawerSection>
        <DrawerSection eyebrow="Assignment" title="Floor handoff"><div className="operational-drawer__rows"><div className="operational-drawer__row"><span>Assigned barber</span>{selected.bookingId === null && ["waiting", "ready"].includes(selected.status) ? <select className="table-select" value={selected.barberId ?? ""} disabled={busy} onChange={(event) => void change(selected, { barberId: event.target.value ? Number(event.target.value) : null })}><option value="">Unassigned</option>{availableBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</select> : <strong>{selected.barberName ?? "Unassigned"}</strong>}</div></div></DrawerSection>
        {!["completed", "removed"].includes(selected.status) && <DrawerSection eyebrow="Queue actions" title="Move customer forward"><div className="operational-drawer__actions">
          {selected.status === "ready" && <Button disabled={busy} onClick={() => void change(selected, { status: "in_progress" })}>Start Service</Button>}
          {selected.status === "in_progress" && <Button disabled={busy} onClick={() => void change(selected, { status: "completed" })}>Complete</Button>}
          {selected.bookingId === null && ["waiting", "ready"].includes(selected.status) && <Button variant="danger" disabled={busy} onClick={() => setPendingRemove(selected)}>Remove</Button>}
        </div></DrawerSection>}
      </>}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(pendingRemove)} title="Remove this queue entry?" confirmLabel="Remove from queue" danger busy={busy} onClose={() => setPendingRemove(null)} onConfirm={() => pendingRemove && void change(pendingRemove, { status: "removed" }, true)} />
  </div>;
}
