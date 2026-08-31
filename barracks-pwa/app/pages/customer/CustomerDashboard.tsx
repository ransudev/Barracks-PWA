"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ApiBarber, ApiBooking, ApiCustomer, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import {
  Avatar,
  Badge,
  Button,
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
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
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
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);

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

  const name = customer ? `${customer.firstName} ${customer.lastName}` : `${user.firstName} ${user.lastName}`;
  const upcoming = bookings.filter((booking) => booking.status === "upcoming");
  const past = bookings.filter((booking) => booking.status !== "upcoming");

  return (
    <div className="customer-page">
      <CustomerTopbar go={go} active="customer-dashboard" onSignOut={onSignOut} user={user} />
      <main className="customer-content">
        <div className="customer-dashboard">
          <div className="customer-dashboard__heading">
            <div>
              <p className="customer-page__eyebrow">Customer account</p>
              <h1>Welcome back, {name.split(" ")[0]}.</h1>
              <p>Your appointments, profile details, and loyalty points in one place.</p>
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
                    <Avatar initials={createInitials(name)} tone="slate" size="lg" />
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
                          <div>
                            <strong>{formatDate(booking.date)}</strong>
                            <span>{formatTime(booking.time)} · {booking.serviceName}</span>
                            <small>with {booking.barberName}</small>
                          </div>
                          <Badge tone="warning">Upcoming</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="calendar"
                      title="No appointments yet"
                      description="Choose a service and time to reserve your next chair."
                      action={<Button size="sm" onClick={() => go("customer-booking")}>Book an appointment</Button>}
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
          <TextField label="Phone number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} icon="phone" />
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
