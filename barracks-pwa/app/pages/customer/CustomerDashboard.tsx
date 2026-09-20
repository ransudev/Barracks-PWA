"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookingForm, type BookingFormValue } from "@/app/components/bookings/BookingForm";
import type { ApiBarberAvailability, ApiBooking, ApiCustomer, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { services } from "@/app/data/services";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  Modal,
  Panel,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { createInitials } from "@/app/utils/format";
import { CustomerTopbar } from "@/app/pages/customer/CustomerTopbar";

type ProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredBarberId: string;
};

function profileForm(customer: ApiCustomer): ProfileDraft {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    preferredBarberId: customer.preferredBarberId ? String(customer.preferredBarberId) : "",
  };
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
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

function formatMemberSince(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function bookingFormValue(booking: ApiBooking): BookingFormValue {
  return {
    customerId: String(booking.customerId),
    serviceId: booking.serviceId,
    barberId: String(booking.barberId),
    date: booking.date,
    time: booking.time,
  };
}

export function CustomerDashboard({
  go,
  onToast,
  onSignOut,
  user,
}: {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
  onSignOut: () => void;
  user: ApiUser;
}) {
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [draft, setDraft] = useState<ProfileDraft>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredBarberId: "",
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBooking, setEditingBooking] = useState<ApiBooking | null>(null);
  const [bookingDraft, setBookingDraft] = useState<BookingFormValue | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [pendingCancellation, setPendingCancellation] = useState<ApiBooking | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [customerResponse, bookingResponse, barberResponse] = await Promise.all([
          apiRequest("/api/customers/me"),
          apiRequest("/api/bookings"),
          apiRequest("/api/barbers"),
        ]);
        const customerBody = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(customerResponse);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[]; message?: string }>(bookingResponse);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[] }>(barberResponse);

        if (!customerResponse.ok || !customerBody?.success || !customerBody.customer) {
          throw new Error(customerBody?.message ?? "Unable to load customer dashboard");
        }
        if (!bookingResponse.ok || !bookingBody?.success) {
          throw new Error(bookingBody?.message ?? "Unable to load appointments");
        }

        setCustomer(customerBody.customer);
        setDraft(profileForm(customerBody.customer));
        setBookings(bookingBody.bookings ?? []);
        if (barberResponse.ok && barberBody?.success) setBarbers(barberBody.barbers ?? []);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load customer dashboard");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [onToast]);

  function openProfileEditor() {
    if (!customer) return;
    setDraft(profileForm(customer));
    setEditing(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await apiRequest("/api/customers/me", {
        method: "PUT",
        body: JSON.stringify({
          ...draft,
          preferredBarberId: draft.preferredBarberId ? Number(draft.preferredBarberId) : null,
        }),
      });
      const body = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(response);

      if (!response.ok || !body?.success || !body.customer) {
        throw new Error(body?.message ?? "Unable to update your profile");
      }

      setCustomer(body.customer);
      setDraft(profileForm(body.customer));
      setEditing(false);
      onToast("Profile updated");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update your profile");
    } finally {
      setSaving(false);
    }
  }

  function openBookingEditor(booking: ApiBooking) {
    setEditingBooking(booking);
    setBookingDraft(bookingFormValue(booking));
  }

  async function saveBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBooking || !bookingDraft) return;
    setBookingSaving(true);

    try {
      const response = await apiRequest(`/api/bookings/${editingBooking.id}`, {
        method: "PUT",
        body: JSON.stringify({
          serviceId: bookingDraft.serviceId,
          barberId: Number(bookingDraft.barberId),
          date: bookingDraft.date,
          time: bookingDraft.time,
        }),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) {
        throw new Error(body?.message ?? "Unable to update your appointment");
      }
      setBookings((current) => current.map((booking) => booking.id === body.booking!.id ? body.booking! : booking));
      setEditingBooking(null);
      setBookingDraft(null);
      onToast("Appointment updated");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update your appointment");
    } finally {
      setBookingSaving(false);
    }
  }

  async function cancelBooking(booking: ApiBooking) {
    setCancellingBookingId(booking.id);

    try {
      const response = await apiRequest(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) {
        throw new Error(body?.message ?? "Unable to cancel your appointment");
      }
      setBookings((current) => current.map((item) => item.id === body.booking!.id ? body.booking! : item));
      setPendingCancellation(null);
      onToast("Appointment cancelled");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to cancel your appointment");
    } finally {
      setCancellingBookingId(null);
    }
  }

  const name = customer ? `${customer.firstName} ${customer.lastName}` : `${user.firstName} ${user.lastName}`;
  const upcoming = bookings.filter((booking) => booking.status === "upcoming");
  const past = bookings.filter((booking) => booking.status !== "upcoming");

  return (
    <div className="customer-page customer-page--dashboard">
      <CustomerTopbar go={go} active="customer-dashboard" onSignOut={onSignOut} user={user} />
      <main className="customer-content">
        <div className="customer-dashboard">
          <div className="customer-dashboard__heading">
            <div>
              <h1>Welcome back, {name.split(" ")[0]}.</h1>
            </div>
            <Button icon="calendar" onClick={() => go("customer-booking")}>Book appointment</Button>
          </div>

          {loading ? (
            <Panel><div className="staff-table__empty">Loading your account…</div></Panel>
          ) : customer ? (
            <>
              <div className="metrics-grid metrics-grid--three">
                <MetricCard label="Loyalty points" value={String(customer.loyaltyPoints)} icon="spark" accent="amber" />
                <MetricCard label="Next appointments" value={String(upcoming.length)} icon="calendar" accent="blue" />
                <MetricCard label="Account status" value="Active" icon="check" accent="green" />
              </div>

              <div className="customer-dashboard__grid">
                <Panel className="customer-summary-panel">
                  <SectionHeading
                    title="Your profile"
                    action={<button className="link-button" type="button" onClick={openProfileEditor}>Edit details</button>}
                  />
                  <div className="customer-summary">
                    <Avatar initials={createInitials(name)} tone="slate" size="lg" className="customer-dashboard__avatar" />
                    <div>
                      <strong>{name}</strong>
                      <span>{customer.email}</span>
                      <span>{customer.phone || "No phone on file"}</span>
                    </div>
                  </div>
                  <div className="customer-profile-inline-facts">
                    <div><small>Preferred barber</small><strong>{customer.preferredBarberName ?? "Not set"}</strong></div>
                    <div><small>Loyalty points</small><strong>{customer.loyaltyPoints}</strong></div>
                    <div><small>Member since</small><strong>{formatMemberSince(customer.createdAt)}</strong></div>
                  </div>
                </Panel>

                <Panel className="customer-bookings-panel">
                  <SectionHeading
                    title="Upcoming appointments"
                    action={<button className="link-button" type="button" onClick={() => go("customer-booking")}>Book another</button>}
                  />
                  {upcoming.length ? (
                    <div className="customer-booking-list">
                      {upcoming.map((booking) => (
                        <div className="customer-booking-card" key={booking.id}>
                          <div className="customer-booking-card__content">
                            <strong>{formatDate(booking.date)}</strong>
                            <span>{formatTime(booking.time)} · {booking.serviceName}</span>
                            <small>with {booking.barberName}</small>
                          </div>
                          <div className="customer-booking-card__actions">
                            <Badge tone="warning">Upcoming</Badge>
                            <Button size="sm" variant="secondary" icon="edit" onClick={() => openBookingEditor(booking)}>Manage</Button>
                            <Button size="sm" variant="danger" onClick={() => setPendingCancellation(booking)}>Cancel</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="calendar"
                      title="No appointments yet"
                      description="Choose a service and time to reserve your next chair."
                    />
                  )}
                </Panel>
              </div>

              <Panel className="customer-history-panel">
                <SectionHeading title="Appointment history" />
                {past.length ? (
                  <div className="customer-booking-list">
                    {past.map((booking) => (
                      <div className="customer-booking-card" key={booking.id}>
                        <div>
                          <strong>{formatDate(booking.date)}</strong>
                          <span>{booking.serviceName} · {booking.barberName}</span>
                        </div>
                        <Badge tone={booking.status === "completed" ? "success" : "danger"}>
                          {booking.status === "completed" ? "Completed" : "Cancelled"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="customer-history-panel__empty">Completed and cancelled appointments will appear here.</p>
                )}
              </Panel>
            </>
          ) : (
            <Panel><EmptyState icon="users" title="Account unavailable" description="Sign out and sign in again to reload your customer account." /></Panel>
          )}
        </div>
      </main>

      <Modal
        open={Boolean(editingBooking && bookingDraft)}
        title="Update your appointment"
        description="You can adjust your own upcoming appointment. Changes are subject to barber availability."
        onClose={() => !bookingSaving && setEditingBooking(null)}
      >
        {bookingDraft && (
          <BookingForm
            value={bookingDraft}
            services={services}
            barbers={barbers.filter((barber) => barber.status !== "unavailable")}
            hideCustomer
            submitLabel="Save appointment"
            submitting={bookingSaving}
            onChange={setBookingDraft}
            onSubmit={saveBooking}
            onCancel={() => setEditingBooking(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingCancellation)}
        title="Cancel this appointment?"
        description={pendingCancellation ? `${formatDate(pendingCancellation.date)} at ${formatTime(pendingCancellation.time)} will be marked cancelled.` : undefined}
        confirmLabel="Cancel appointment"
        danger
        busy={cancellingBookingId !== null}
        onClose={() => cancellingBookingId === null && setPendingCancellation(null)}
        onConfirm={() => pendingCancellation && void cancelBooking(pendingCancellation)}
      />

      <Modal
        open={editing}
        title="Edit your profile"
        description="Keep your contact details and barber preference up to date."
        onClose={() => !saving && setEditing(false)}
      >
        <form className="modal-form" onSubmit={saveProfile}>
          <div className="form-grid form-grid--two">
            <TextField label="First name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
            <TextField label="Last name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
          </div>
          <TextField label="Email address" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} icon="mail" />
          <TextField label="Phone number" type="tel" inputMode="numeric" maxLength={11} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} icon="phone" />
          <SelectField label="Preferred barber" value={draft.preferredBarberId} onChange={(event) => setDraft({ ...draft, preferredBarberId: event.target.value })}>
            <option value="">Not set</option>
            {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}
          </SelectField>
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" icon="check" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
