"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiBarber, ApiBooking, ApiInventoryItem } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { createInitials, formatCurrency } from "@/app/utils/format";
import { Avatar, Badge, Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

function displayName(barber: ApiBarber) {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

function statusLabel(status: ApiBarber["status"]) {
  return status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
}

function statusTone(status: ApiBarber["status"]): "success" | "warning" | "neutral" {
  return status === "available" ? "success" : status === "busy" ? "warning" : "neutral";
}

function dateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

export function StaffDashboard({
  go,
  onToast,
}: {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
}) {
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [barberResponse, bookingResponse, inventoryResponse] = await Promise.all([
          apiRequest("/api/barbers"),
          apiRequest("/api/bookings"),
          apiRequest("/api/inventory"),
        ]);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(barberResponse);
        const bookingBody = await readApiBody<{ success: boolean; bookings?: ApiBooking[]; message?: string }>(bookingResponse);
        const inventoryBody = await readApiBody<{ success: boolean; items?: ApiInventoryItem[]; message?: string }>(inventoryResponse);
        if (!barberResponse.ok || !barberBody?.success || !barberBody.barbers) throw new Error(barberBody?.message ?? "Unable to load barbers");
        if (!bookingResponse.ok || !bookingBody?.success) throw new Error(bookingBody?.message ?? "Unable to load bookings");
        if (!inventoryResponse.ok || !inventoryBody?.success) throw new Error(inventoryBody?.message ?? "Unable to load inventory");
        if (cancelled) return;
        setBarbers(barberBody.barbers);
        setBookings(bookingBody.bookings ?? []);
        setInventory(inventoryBody.items ?? []);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load dashboard";
          setLoadError(message);
          onToast(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  const today = dateString();
  const todayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === today && booking.status !== "cancelled"),
    [bookings, today],
  );
  const upcomingBookings = useMemo(
    () => bookings
      .filter((booking) => booking.status === "upcoming" && booking.date >= today)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [bookings, today],
  );
  const activeBarbers = barbers.filter((barber) => barber.status !== "unavailable").length;
  const lowStockCount = inventory.filter((item) => item.quantity <= item.minimumStock).length;

  return (
    <div className="staff-dashboard">
      <PageHeader title="Dashboard" description="Overview of today’s shop floor operations" action={<Button icon="scissors" onClick={() => go("barbers")}>Manage roster</Button>} />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard label="Customers in queue" value="—" change="Queue tracking not connected" changeTone="warning" icon="queue" accent="blue" />
        <MetricCard label="Today’s bookings" value={loading ? "—" : String(todayBookings.length)} icon="calendar" accent="amber" />
        <MetricCard label="Active barbers" value={loading ? "—" : String(activeBarbers)} icon="scissors" accent="green" />
        <MetricCard label="Stock alerts" value={loading ? "—" : String(lowStockCount)} change={lowStockCount ? "Needs attention" : undefined} changeTone="warning" icon="box" accent="red" />
      </div>

      <div className="quick-actions" aria-label="Dashboard quick actions">
        <button type="button" onClick={() => go("customers")}>
          <span className="quick-actions__icon quick-actions__icon--blue"><Icon name="userPlus" size={17} /></span>
          <span><strong>Register customer</strong><small>Add a new customer account</small></span>
          <Icon name="arrowRight" size={15} />
        </button>
        <button type="button" onClick={() => go("bookings")}>
          <span className="quick-actions__icon quick-actions__icon--green"><Icon name="calendar" size={17} /></span>
          <span><strong>New booking</strong><small>Reserve a time for a customer</small></span>
          <Icon name="arrowRight" size={15} />
        </button>
        <button type="button" onClick={() => go("inventory")}>
          <span className="quick-actions__icon quick-actions__icon--red"><Icon name="box" size={17} /></span>
          <span><strong>Review inventory</strong><small>{lowStockCount ? `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} need attention` : "Check current stock levels"}</small></span>
          <Icon name="arrowRight" size={15} />
        </button>
      </div>

      <div className="dashboard-grid dashboard-grid--wide">
        <Panel className="queue-preview">
          <SectionHeading title="Quick queue view" description="Walk-ins waiting for service" />
          <EmptyState icon="queue" title="No customers in queue" description="Walk-in entries will appear here when queue tracking is connected." />
        </Panel>

        <Panel className="schedule-preview">
          <SectionHeading
            title="Upcoming bookings"
            action={<Button variant="ghost" size="sm" iconAfter="arrowRight" onClick={() => go("bookings")}>View all</Button>}
          />
          <div className="schedule-list">
            {loading ? <div className="staff-table__empty">Loading bookings…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : upcomingBookings.length ? upcomingBookings.slice(0, 3).map((booking, index) => (
              <div className={`schedule-row ${index === 0 ? "is-priority" : ""}`} key={booking.id}>
                <span className="schedule-row__time"><strong>{formatTime(booking.time)}</strong><small>{formatDate(booking.date)}</small></span>
                <span className="schedule-row__line" aria-hidden="true" />
                <span><strong>{booking.customerName}</strong><small>{booking.serviceName} · {booking.barberName}</small></span>
                <strong className="schedule-row__price">{formatCurrency(booking.price)}</strong>
              </div>
            )) : <EmptyState icon="calendar" title="No upcoming bookings" description="Scheduled appointments will appear here." />}
          </div>
        </Panel>
      </div>

      <Panel className="barber-dashboard-panel">
        <SectionHeading title="Live barber overview" />
        <div className="barber-status-grid">
          {loading ? (
            <div className="staff-table__empty">Loading barber profiles…</div>
          ) : loadError ? (
            <div className="staff-table__empty">{loadError}</div>
          ) : barbers.length ? (
            barbers.map((barber) => {
              const name = displayName(barber);
              return (
                <article className="barber-status-card" key={barber.id}>
                  <div className="barber-status-card__head">
                    <Avatar initials={createInitials(name)} tone="slate" size="md" />
                    <Badge tone={statusTone(barber.status)}>{statusLabel(barber.status)}</Badge>
                  </div>
                  <strong>{name}</strong>
                  <div className="barber-status-card__stats">
                    <span><small>Status</small><strong>{statusLabel(barber.status)}</strong></span>
                    <span><small>Commission</small><strong>{barber.commissionRate === null ? "—" : `${barber.commissionRate}%`}</strong></span>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState icon="scissors" title="No barber profiles" description="Add barber records from the roster to populate this overview." />
          )}
        </div>
      </Panel>
    </div>
  );
}
