"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookingForm, type BookingFormValue } from "@/app/components/bookings/BookingForm";
import { services } from "@/app/data/services";
import type { ApiBarber, ApiBooking, ApiBookingStatus, ApiCustomer } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Avatar, Badge, Button, EmptyState, MetricCard, Modal, PageHeader, Panel, SearchInput, SectionHeading, Tabs } from "@/app/components/ui";
import { createInitials, formatCurrency } from "@/app/utils/format";

function dateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateString(date);
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const meridiem = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

function statusTone(status: ApiBookingStatus): "success" | "warning" | "danger" {
  return status === "completed" ? "success" : status === "upcoming" ? "warning" : "danger";
}

function statusLabel(status: ApiBookingStatus) {
  return status[0].toUpperCase() + status.slice(1);
}

function emptyForm(customerId = "", barberId = ""): BookingFormValue {
  return {
    customerId,
    serviceId: services[0]?.id ?? "",
    barberId,
    date: futureDate(),
    time: "10:00",
  };
}

export function BookingsPage({ onToast }: { onToast: (message: string) => void }) {
  const [items, setItems] = useState<ApiBooking[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ApiBooking | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<BookingFormValue>(emptyForm());

  useEffect(() => {
    async function load() {
      try {
        const [bookingResponse, customerResponse, barberResponse] = await Promise.all([
          apiRequest("/api/bookings"),
          apiRequest("/api/customers"),
          apiRequest("/api/barbers"),
        ]);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[]; message?: string }>(bookingResponse);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[]; message?: string }>(customerResponse);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(barberResponse);
        if (!bookingResponse.ok || !bookingBody?.success) throw new Error(bookingBody?.message ?? "Unable to load bookings");
        if (!customerResponse.ok || !customerBody?.success) throw new Error(customerBody?.message ?? "Unable to load customers");
        if (!barberResponse.ok || !barberBody?.success) throw new Error(barberBody?.message ?? "Unable to load barbers");
        const nextCustomers = customerBody.customers ?? [];
        const nextBarbers = barberBody.barbers ?? [];
        setItems(bookingBody.bookings ?? []);
        setCustomers(nextCustomers);
        setBarbers(nextBarbers);
        setDraft(emptyForm(String(nextCustomers[0]?.id ?? ""), String(nextBarbers.find((barber) => barber.status !== "unavailable")?.id ?? "")));
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load bookings");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const counts = {
    today: items.filter((item) => item.date === dateString()).length,
    upcoming: items.filter((item) => item.status === "upcoming").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
  };

  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesTab = tab === "today" ? item.date === dateString() : item.status === tab;
      const searchable = `${item.customerName} ${item.barberName} ${item.serviceName}`.toLowerCase();
      return matchesTab && (!query || searchable.includes(query));
    });
  }, [items, search, tab]);

  function openNewBooking() {
    setDraft(emptyForm(String(customers[0]?.id ?? ""), String(barbers.find((barber) => barber.status !== "unavailable")?.id ?? "")));
    setBookingModalOpen(true);
  }

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.customerId || !draft.serviceId || !draft.barberId || !draft.date || !draft.time) {
      onToast("Complete the booking details first");
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerId: Number(draft.customerId),
          serviceId: draft.serviceId,
          barberId: Number(draft.barberId),
          date: draft.date,
          time: draft.time,
        }),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) throw new Error(body?.message ?? "Unable to create booking");
      setItems((current) => [...current, body.booking as ApiBooking].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
      setBookingModalOpen(false);
      onToast("Booking created");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(booking: ApiBooking, status: ApiBookingStatus) {
    try {
      const response = await apiRequest(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) throw new Error(body?.message ?? "Unable to update booking");
      setItems((current) => current.map((item) => item.id === booking.id ? body.booking as ApiBooking : item));
      setSelected(null);
      onToast(`Booking marked ${status}`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update booking");
    }
  }

  return <>
    <PageHeader title="Bookings" action={<Button icon="plus" disabled={loading || !customers.length || !barbers.length} onClick={openNewBooking}>New booking</Button>} />
    <div className="booking-tabs-row"><Tabs active={tab} onChange={setTab} items={[{ id: "today", label: "Today", count: counts.today }, { id: "upcoming", label: "Upcoming", count: counts.upcoming }, { id: "completed", label: "Completed", count: counts.completed }, { id: "cancelled", label: "Cancelled", count: counts.cancelled }]} /><SearchInput value={search} onChange={setSearch} placeholder="Search bookings" /></div>
    <div className="metrics-grid metrics-grid--four"><MetricCard label="All bookings" value={String(items.length)} icon="calendar" accent="blue" /><MetricCard label="Today" value={String(counts.today)} icon="clock" accent="amber" /><MetricCard label="Completed" value={String(counts.completed)} icon="checkCircle" accent="green" /><MetricCard label="Cancelled" value={String(counts.cancelled)} icon="x" accent="red" /></div>
    <Panel className="bookings-panel"><SectionHeading title={tab === "today" ? "Today’s schedule" : `${statusLabel(tab as ApiBookingStatus)} bookings`} /><div className="booking-list">{loading ? <div className="staff-table__empty">Loading bookings…</div> : visible.length ? visible.map((booking) => <button className={`booking-row booking-row--${booking.status}`} type="button" key={booking.id} onClick={() => setSelected(booking)}><span className="booking-row__time"><strong>{formatTime(booking.time)}</strong><small>{formatDate(booking.date)}</small></span><span className="booking-row__customer"><Avatar initials={createInitials(booking.customerName)} tone="slate" size="sm" /><span><strong>{booking.customerName}</strong><small>{booking.customerEmail}</small></span></span><span className="booking-row__service"><strong>{booking.serviceName}</strong><small>with {booking.barberName}</small></span><span><Badge tone={statusTone(booking.status)}>{statusLabel(booking.status)}</Badge></span><strong className="booking-row__price">{formatCurrency(booking.price)}</strong></button>) : <EmptyState icon="calendar" title="No bookings found" description="Create a booking or switch to another view." />}</div></Panel>
    <Modal open={bookingModalOpen} title="New booking" onClose={() => !submitting && setBookingModalOpen(false)}><BookingForm value={draft} customers={customers} services={services} barbers={barbers} submitLabel="Create booking" submitting={submitting} onChange={setDraft} onSubmit={createBooking} onCancel={() => setBookingModalOpen(false)} /></Modal>
    <Modal open={Boolean(selected)} title="Booking details" onClose={() => setSelected(null)}>{selected && <div className="detail-modal"><div className="detail-modal__identity"><Avatar initials={createInitials(selected.customerName)} tone="slate" size="lg" /><div><strong>{selected.customerName}</strong><span>{selected.serviceName}</span></div><Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge></div><div className="detail-facts"><span><small>When</small><strong>{formatDate(selected.date)} · {formatTime(selected.time)}</strong></span><span><small>Barber</small><strong>{selected.barberName}</strong></span><span><small>Total</small><strong>{formatCurrency(selected.price)}</strong></span></div>{selected.status === "upcoming" && <div className="modal-actions"><Button variant="secondary" onClick={() => void updateStatus(selected, "completed")}>Mark completed</Button><Button variant="danger" onClick={() => void updateStatus(selected, "cancelled")}>Cancel booking</Button></div>}</div>}</Modal>
  </>;
}
