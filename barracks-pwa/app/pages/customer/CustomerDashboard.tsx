"use client";

import { useEffect, useState } from "react";
import type { ApiBooking, ApiCustomer, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { Avatar, Badge, Button, EmptyState, MetricCard, Panel, SectionHeading } from "@/app/components/ui";
import { createInitials } from "@/app/utils/format";
import { CustomerTopbar } from "@/app/pages/customer/CustomerProfile";

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

export function CustomerDashboard({ go, onToast, onSignOut, user }: { go: (view: ViewId) => void; onToast: (message: string) => void; onSignOut: () => void; user: ApiUser }) {
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [customerResponse, bookingResponse] = await Promise.all([
          apiRequest("/api/customers/me"),
          apiRequest("/api/bookings"),
        ]);
        const customerBody = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(customerResponse);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[]; message?: string }>(bookingResponse);
        if (!customerResponse.ok || !customerBody?.success || !customerBody.customer) throw new Error(customerBody?.message ?? "Unable to load customer dashboard");
        if (!bookingResponse.ok || !bookingBody?.success) throw new Error(bookingBody?.message ?? "Unable to load appointments");
        setCustomer(customerBody.customer);
        setBookings(bookingBody.bookings ?? []);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load customer dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const name = customer ? `${customer.firstName} ${customer.lastName}` : `${user.firstName} ${user.lastName}`;
  const upcoming = bookings.filter((booking) => booking.status === "upcoming");
  const past = bookings.filter((booking) => booking.status !== "upcoming");

  return <div className="customer-page"><CustomerTopbar go={go} active="customer-dashboard" onSignOut={onSignOut} user={user} /><main className="customer-content"><div className="customer-dashboard__heading"><div><p className="customer-page__eyebrow">Customer dashboard</p><h1>Welcome back, {name.split(" ")[0]}.</h1><p>Your next visit, profile details, and appointment history in one place.</p></div><Button icon="calendar" onClick={() => go("customer-booking")}>Book appointment</Button></div>{loading ? <Panel><div className="staff-table__empty">Loading your appointments…</div></Panel> : customer ? <><div className="metrics-grid metrics-grid--three"><MetricCard label="Loyalty points" value={String(customer.loyaltyPoints)} icon="spark" accent="amber" /><MetricCard label="Next appointments" value={String(upcoming.length)} icon="calendar" accent="blue" /><MetricCard label="Account status" value="Active" icon="check" accent="green" /></div><div className="customer-dashboard__grid"><Panel className="customer-summary-panel"><SectionHeading title="Your profile" action={<button className="link-button" type="button" onClick={() => go("customer-profile")}>Edit details</button>} /><div className="customer-summary"><Avatar initials={createInitials(name)} tone="slate" size="lg" /><div><strong>{name}</strong><span>{customer.email}</span><span>{customer.phone || "No phone on file"}</span></div></div></Panel><Panel className="customer-bookings-panel"><SectionHeading title="Upcoming appointments" action={<button className="link-button" type="button" onClick={() => go("customer-booking")}>Book another</button>} />{upcoming.length ? <div className="customer-booking-list">{upcoming.map((booking) => <div className="customer-booking-card" key={booking.id}><div><strong>{formatDate(booking.date)}</strong><span>{formatTime(booking.time)} · {booking.serviceName}</span><small>with {booking.barberName}</small></div><Badge tone="warning">Upcoming</Badge></div>)}</div> : <EmptyState icon="calendar" title="No appointments yet" description="Choose a service and time to reserve your next chair." action={<Button size="sm" onClick={() => go("customer-booking")}>Book an appointment</Button>} />}</Panel></div><Panel className="customer-history-panel"><SectionHeading title="Appointment history" />{past.length ? <div className="customer-booking-list">{past.map((booking) => <div className="customer-booking-card" key={booking.id}><div><strong>{formatDate(booking.date)}</strong><span>{booking.serviceName} · {booking.barberName}</span></div><Badge tone={booking.status === "completed" ? "success" : "danger"}>{booking.status === "completed" ? "Completed" : "Cancelled"}</Badge></div>)}</div> : <p className="customer-history-panel__empty">Completed and cancelled appointments will appear here.</p>}</Panel></> : <Panel><EmptyState icon="users" title="Dashboard unavailable" description="Sign out and sign in again to reload your customer account." /></Panel>}</main></div>;
}
