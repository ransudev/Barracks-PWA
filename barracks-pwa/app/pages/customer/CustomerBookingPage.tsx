"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookingForm, type BookingFormValue } from "@/app/components/bookings/BookingForm";
import { Button, EmptyState, Panel } from "@/app/components/ui";
import type { ApiBarber, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { services } from "@/app/data/services";
import type { ViewId } from "@/app/types/domain";
import { CustomerTopbar } from "@/app/pages/customer/CustomerTopbar";

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function CustomerBookingPage({
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
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [value, setValue] = useState<BookingFormValue>({
    customerId: "",
    serviceId: services[0]?.id ?? "",
    barberId: "",
    date: futureDate(),
    time: "10:00",
  });

  useEffect(() => {
    async function loadBarbers() {
      try {
        const response = await apiRequest("/api/barbers");
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
        if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load barbers");
        const available = (body.barbers ?? []).filter((barber) => barber.status !== "unavailable");
        setBarbers(available);
        setValue((current) => ({ ...current, barberId: current.barberId || String(available[0]?.id ?? "") }));
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load barbers");
      } finally {
        setLoading(false);
      }
    }
    void loadBarbers();
  }, [onToast]);

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.serviceId || !value.barberId || !value.date || !value.time) {
      onToast("Choose a service, barber, date, and time");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId: value.serviceId,
          barberId: Number(value.barberId),
          date: value.date,
          time: value.time,
        }),
      });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to create booking");
      onToast("Appointment booked");
      go("customer-dashboard");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to create booking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="customer-page">
      <CustomerTopbar go={go} active="customer-booking" onSignOut={onSignOut} user={user} />
      <main className="customer-content">
        <div className="customer-booking-page">
          <div className="customer-booking-page__heading">
            <div>
              <p className="customer-page__eyebrow">Book a chair</p>
              <h1>Choose your next visit.</h1>
              <p>Pick a service, barber, and time. Your appointment will appear on your dashboard.</p>
            </div>
            <Button variant="secondary" onClick={() => go("customer-dashboard")}>Back to dashboard</Button>
          </div>
          <Panel className="customer-booking-panel">
            {loading ? (
              <div className="staff-table__empty">Loading available barbers…</div>
            ) : barbers.length ? (
              <BookingForm value={value} services={services} barbers={barbers} hideCustomer submitLabel="Confirm appointment" submitting={submitting} onChange={setValue} onSubmit={createBooking} onCancel={() => go("customer-dashboard")} />
            ) : (
              <EmptyState icon="scissors" title="No barbers available" description="There are no barbers available to book right now. Please try again later." action={<Button onClick={() => go("customer-dashboard")}>Back to dashboard</Button>} />
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
