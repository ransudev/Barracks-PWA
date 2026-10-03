"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookingForm, type BookingFormValue } from "@/app/components/bookings/BookingForm";
import type { Service } from "@/app/types/domain";
import type { ApiBarberAvailability, ApiBooking, ApiBookingStatus, ApiCustomer } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, MetricCard, Modal, PageHeader, Panel, Tabs } from "@/app/components/ui";
import { createInitials, dateInputValue, formatCurrency, futureDateInputValue } from "@/app/utils/format";
import { DetailDrawer, DrawerSection, FilterToolbar, RecordCard, ResponsiveTable, ViewToggle, type OperationalViewMode } from "@/app/components/operations/OperationalPrimitives";
import { mayMarkNoShow } from "@/app/constants/booking";

const statuses: ApiBookingStatus[] = ["confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"];
const label = (status: string) => status.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const freshForm = (customerId = ""): BookingFormValue => ({ customerId, serviceId: "", barberId: "", date: futureDateInputValue(), time: "", notes: "" });
const formFromBooking = (booking: ApiBooking): BookingFormValue => ({ customerId: String(booking.customerId), serviceId: booking.serviceId, barberId: String(booking.barberId), date: booking.date, time: booking.time, notes: booking.notes ?? "" });
const bookingPayload = (value: BookingFormValue) => ({ customerId: Number(value.customerId), serviceId: value.serviceId, barberId: value.barberId ? Number(value.barberId) : null, date: value.date, time: value.time, notes: value.notes });

export function BookingsPage({ onToast, canOperate = true, canDelete = false }: { onToast: (message: string) => void; canOperate?: boolean; canDelete?: boolean }) {
  const [items, setItems] = useState<ApiBooking[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("today");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OperationalViewMode>("cards");
  const [selected, setSelected] = useState<ApiBooking | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<BookingFormValue>(freshForm());
  const [busy, setBusy] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [pendingCancellation, setPendingCancellation] = useState<ApiBooking | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<ApiBooking | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [bookingResponse, customerResponse, barberResponse, serviceResponse] = await Promise.all([
          apiRequest("/api/bookings", { cache: "no-store" }), apiRequest("/api/customers", { cache: "no-store", reuseForMs: 15_000 }),
          apiRequest("/api/barbers", { cache: "no-store" }), apiRequest("/api/services", { cache: "no-store", reuseForMs: 15_000 }),
        ]);
        const [bookings, customerData, barberData, serviceData] = await Promise.all([
          readApiBody<{ success: boolean; bookings?: ApiBooking[]; message?: string }>(bookingResponse),
          readApiBody<{ success: boolean; customers?: ApiCustomer[]; message?: string }>(customerResponse),
          readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[]; message?: string }>(barberResponse),
          readApiBody<{ success: boolean; services?: Service[]; message?: string }>(serviceResponse),
        ]);
        if (!bookingResponse.ok || !bookings?.success || !customerResponse.ok || !customerData?.success || !barberResponse.ok || !barberData?.success || !serviceResponse.ok || !serviceData?.success) {
          throw new Error(bookings?.message ?? customerData?.message ?? barberData?.message ?? serviceData?.message ?? "Unable to load bookings");
        }
        if (!active) return;
        setItems(bookings.bookings ?? []);
        setCustomers(customerData.customers ?? []);
        setBarbers(barberData.barbers ?? []);
        setServices(serviceData.services ?? []);
        setLoadError("");
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load bookings");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const counts = Object.fromEntries(["today", ...statuses].map((status) => [status, items.filter((item) => status === "today" ? item.date === dateInputValue() : item.status === status).length]));
  const visible = useMemo(() => items.filter((item) => (tab === "today" ? item.date === dateInputValue() : item.status === tab) &&
    `${item.customerName} ${item.barberName} ${item.serviceName}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)), [items, tab, search]);
  const bookingForm = <BookingForm value={draft} customers={customers} services={services} barbers={barbers} excludeBookingId={editing ? selected?.id : undefined} availabilityVersion={availabilityVersion}
    submitLabel={editing ? "Save booking" : "Create booking"} submitting={busy} onChange={setDraft} onSubmit={saveBooking} onCancel={() => { setCreating(false); setEditing(false); }} />;

  async function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.customerId || !draft.serviceId || !draft.time) return;
    setBusy(true);
    try {
      const response = await apiRequest(editing && selected ? `/api/bookings/${selected.id}` : "/api/bookings", {
        method: editing ? "PUT" : "POST", body: JSON.stringify(bookingPayload(draft)),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) throw new Error(body?.message ?? "Unable to save booking");
      setItems((current) => editing ? current.map((item) => item.id === body.booking!.id ? body.booking! : item) : [...current, body.booking!]);
      setSelected(editing ? body.booking : null);
      setEditing(false);
      setCreating(false);
      onToast("Booking saved");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to save booking");
      setDraft((current) => ({ ...current, time: "" }));
      setAvailabilityVersion((current) => current + 1);
    } finally { setBusy(false); }
  }

  async function updateStatus(booking: ApiBooking, status: ApiBookingStatus) {
    setBusy(true);
    try {
      const response = await apiRequest(`/api/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) throw new Error(body?.message ?? "Unable to update booking");
      setItems((current) => current.map((item) => item.id === booking.id ? body.booking! : item));
      setSelected(body.booking);
      setPendingCancellation(null);
      onToast(`Booking marked ${label(status)}`);
    } catch (error) { onToast(error instanceof Error ? error.message : "Unable to update booking"); }
    finally { setBusy(false); }
  }

  async function deleteBooking(booking: ApiBooking) {
    setBusy(true);
    try {
      const response = await apiRequest(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to delete booking");
      setItems((current) => current.filter((item) => item.id !== booking.id));
      setSelected(null);
      setPendingDeletion(null);
      onToast("Booking deleted");
    } catch (error) { onToast(error instanceof Error ? error.message : "Unable to delete booking"); }
    finally { setBusy(false); }
  }

  const openEdit = (booking: ApiBooking) => { if (booking.status !== "confirmed") return; setSelected(booking); setDraft(formFromBooking(booking)); setEditing(true); };
  const openCreate = () => { setDraft(freshForm(String(customers[0]?.id ?? ""))); setCreating(true); };
  const tone = (status: ApiBookingStatus) => status === "completed" ? "success" : status === "cancelled" || status === "no_show" ? "danger" : "warning";

  return <div className="operational-workspace">
    <PageHeader title="Bookings" description={canOperate ? "Manage appointments through check in, service, and completion." : "Review appointments and their current status."} action={<><ViewToggle view={view} onChange={setView} label="Choose booking view" />{canOperate && <Button icon="plus" disabled={loading || !customers.length || !services.some((service) => service.active)} onClick={openCreate}>New booking</Button>}</>} />
    <div className="booking-tabs-row"><Tabs active={tab} onChange={setTab} items={[{ id: "today", label: "Today", count: counts.today }, ...statuses.map((status) => ({ id: status, label: label(status), count: counts[status] }))]} /></div>
    <div className="metrics-grid metrics-grid--four"><MetricCard label="All bookings" value={String(items.length)} icon="calendar" accent="blue" /><MetricCard label="Today" value={String(counts.today)} icon="clock" accent="amber" /><MetricCard label="Completed" value={String(counts.completed)} icon="checkCircle" accent="green" /><MetricCard label="Cancelled" value={String(counts.cancelled)} icon="x" accent="red" /></div>
    <Panel className="operational-panel"><FilterToolbar search={search} onSearchChange={setSearch} placeholder="Search bookings" resultCount={visible.length} />
      {loading ? <p role="status">Loading bookings…</p> : loadError ? <p role="alert">{loadError}</p> : !visible.length ? <EmptyState icon="calendar" title="No bookings found" description="Choose another schedule view or create a booking." /> : view === "cards" ?
        <div className="operational-card-grid">{visible.map((booking) => <RecordCard key={booking.id} onOpen={() => { setSelected(booking); setEditing(false); }} ariaLabel={`Open booking for ${booking.customerName}`}><div className="operational-card__header"><h3>{booking.date} · {booking.time}</h3><Badge tone={tone(booking.status)}>{label(booking.status)}</Badge></div><div className="operational-card__identity"><Avatar initials={createInitials(booking.customerName)} tone="slate" size="sm" /><strong>{booking.customerName}</strong></div><p>{booking.serviceName} · {booking.barberName}</p><small>#{booking.id} · {formatCurrency(booking.price)}</small></RecordCard>)}</div> :
        <ResponsiveTable headers={["When", "Customer", "Service", "Barber", "Status"]}>{visible.map((booking) => <tr key={booking.id} tabIndex={0} onClick={() => { setSelected(booking); setEditing(false); }} onKeyDown={(event) => { if (event.key === "Enter") setSelected(booking); }}><td>{booking.date} · {booking.time}</td><td>{booking.customerName}</td><td>{booking.serviceName}</td><td>{booking.barberName}</td><td><Badge tone={tone(booking.status)}>{label(booking.status)}</Badge></td></tr>)}</ResponsiveTable>}
    </Panel>
    <Modal open={creating} title="New booking" onClose={() => !busy && setCreating(false)}>{bookingForm}</Modal>
    <DetailDrawer open={Boolean(selected)} title="Booking details" subtitle={selected ? `${selected.customerName} · #${selected.id}` : undefined} eyebrow="Appointment" onClose={() => { setSelected(null); setEditing(false); }}>
      {selected && (editing ? <DrawerSection eyebrow="Edit appointment" title="Update booking">{bookingForm}</DrawerSection> : <>
        <DrawerSection><div className="operational-drawer__identity"><Avatar initials={createInitials(selected.customerName)} tone="slate" size="lg" /><div><strong>{selected.customerName}</strong><span>{selected.customerEmail}</span></div><Badge tone={tone(selected.status)}>{label(selected.status)}</Badge></div></DrawerSection>
        <DrawerSection eyebrow="Appointment facts" title="Schedule snapshot"><div className="operational-drawer__facts"><div><span>When</span><strong>{selected.date} · {selected.time}–{selected.endTime ?? "?"}</strong></div><div><span>Service</span><strong>{selected.serviceName} · {selected.durationMinutes ?? "?"} min</strong></div><div><span>Barber</span><strong>{selected.barberName}</strong></div><div><span>Price</span><strong>{formatCurrency(selected.price)}</strong></div><div><span>Notes</span><strong>{selected.notes || "None"}</strong></div></div></DrawerSection>
        {(canOperate || canDelete) && !["completed", "cancelled", "no_show"].includes(selected.status) && <DrawerSection eyebrow="Actions" title="Manage appointment"><div className="operational-drawer__actions">
          {canOperate && selected.status === "confirmed" && <><Button variant="secondary" disabled={busy} onClick={() => openEdit(selected)}>Edit</Button><Button disabled={busy} onClick={() => void updateStatus(selected, "checked_in")}>Check In</Button><Button variant="secondary" disabled={busy || !mayMarkNoShow(selected.date, selected.time, new Date(now))} onClick={() => void updateStatus(selected, "no_show")}>Mark No Show</Button></>}
          {canOperate && selected.status === "checked_in" && <Button disabled={busy} onClick={() => void updateStatus(selected, "in_progress")}>Start Service</Button>}
          {canOperate && selected.status === "in_progress" && <Button disabled={busy} onClick={() => void updateStatus(selected, "completed")}>Complete</Button>}
          {canOperate && (selected.status === "confirmed" || selected.status === "checked_in") && <Button variant="danger" disabled={busy} onClick={() => setPendingCancellation(selected)}>Cancel</Button>}
          {canDelete && selected.status === "confirmed" && <Button variant="danger" disabled={busy} onClick={() => setPendingDeletion(selected)}>Delete booking</Button>}
        </div></DrawerSection>}
      </>)}
    </DetailDrawer>
    <ConfirmDialog open={Boolean(pendingCancellation)} title="Cancel this booking?" confirmLabel="Cancel booking" danger busy={busy} onClose={() => setPendingCancellation(null)} onConfirm={() => pendingCancellation && void updateStatus(pendingCancellation, "cancelled")} />
    <ConfirmDialog open={Boolean(pendingDeletion)} title="Delete this booking?" confirmLabel="Delete booking" danger busy={busy} onClose={() => setPendingDeletion(null)} onConfirm={() => pendingDeletion && void deleteBooking(pendingDeletion)} />
  </div>;
}
