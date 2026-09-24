"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BookingForm, type BookingFormValue } from "@/app/components/bookings/BookingForm";
import { Button, EmptyState } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import type { ApiBarberAvailability, ApiBooking, ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import type { Service, ViewId } from "@/app/types/domain";
import { CustomerTopbar } from "@/app/pages/customer/CustomerTopbar";
import { futureDateInputValue } from "@/app/utils/format";

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
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<ApiBooking | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [value, setValue] = useState<BookingFormValue>({
    customerId: "",
    serviceId: "",
    barberId: "",
    date: futureDateInputValue(),
    time: "",
    notes: "",
  });

  const selectedService = services.find((service) => service.id === value.serviceId);
  const selectedBarber = barbers.find((barber) => String(barber.id) === String(value.barberId));

  useEffect(() => {
    async function loadBarbers() {
      try {
        const [response, serviceResponse] = await Promise.all([apiRequest("/api/barbers"), apiRequest("/api/services")]);
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[]; message?: string }>(response);
        const serviceBody = await readApiBody<{ success: boolean; services?: Service[]; message?: string }>(serviceResponse);
        if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load barbers");
        if (!serviceResponse.ok || !serviceBody?.success) throw new Error(serviceBody?.message ?? "Unable to load services");
        const available = (body.barbers ?? []).filter((barber) => barber.status !== "unavailable");
        setBarbers(available);
        setServices(serviceBody.services ?? []);
        setValue((current) => ({ ...current, serviceId: current.serviceId || serviceBody.services?.find((service) => service.active)?.id || "" }));
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
    if (!value.serviceId || !value.date || !value.time) {
      onToast("Choose a service, date, and available time");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId: value.serviceId,
          barberId: value.barberId ? Number(value.barberId) : null,
          date: value.date,
          time: value.time,
          notes: value.notes,
        }),
      });
      const body = await readApiBody<{ success: boolean; booking?: ApiBooking; message?: string }>(response);
      if (!response.ok || !body?.success || !body.booking) throw new Error(body?.message ?? "Unable to create booking");
      setConfirmation(body.booking);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to create booking");
      setValue((current) => ({ ...current, time: "" }));
      setAvailabilityVersion((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="customer-page customer-booking-view">
      <CustomerTopbar go={go} active="customer-booking" onSignOut={onSignOut} user={user} />
      <main className="customer-content">
        <div className="booking-hero-header">
          <div className="booking-hero-header__left">
            <h1>
              BOOK YOUR <span className="accent-crimson">CHAIR.</span>
            </h1>
          </div>
          <button
            type="button"
            className="booking-back-btn"
            onClick={() => go("customer-dashboard")}
          >
            <Icon name="chevronLeft" size={14} />
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div className="booking-workspace-grid">
          {/* Main Form Column */}
          <div className="booking-form-card">
            {confirmation ? (
              <div className="booking-form-review" role="status">
                <h2>Appointment confirmed</h2>
                <p>Booking #{confirmation.id} · {confirmation.status}</p>
                <p>{confirmation.customerName} · {confirmation.serviceName}</p>
                <p>Assigned barber: {confirmation.barberName}</p>
                <p>{confirmation.date} · {confirmation.time}–{confirmation.endTime}</p>
                <p>{confirmation.durationMinutes} minutes · ₱{confirmation.price}</p>
                <p>Notes: {confirmation.notes || "None"}</p>
                <div className="modal-actions"><Button onClick={() => go("customer-dashboard")}>View My Appointments</Button><Button variant="secondary" onClick={() => go("customer-dashboard")}>Back to Dashboard</Button></div>
              </div>
            ) : loading ? (
              <div className="booking-loading">
                Loading available barbers…
              </div>
            ) : barbers.length ? (
              <BookingForm
                value={value}
                services={services}
                barbers={barbers}
                hideCustomer
                submitLabel="Confirm appointment"
                submitting={submitting}
                availabilityVersion={availabilityVersion}
                onChange={setValue}
                onSubmit={createBooking}
                onCancel={() => go("customer-dashboard")}
              />
            ) : (
              <EmptyState
                icon="scissors"
                title="No barbers available"
                description="There are no barbers available to book right now. Please check back shortly or visit one of our 4 Davao HQs."
                action={<Button onClick={() => go("customer-dashboard")}>Back to Dashboard</Button>}
              />
            )}
          </div>

          {/* Right Summary Sidebar */}
          <aside className="booking-summary-sidebar">
            <div className="booking-summary-card">
              <div className="booking-summary-card__header">
                <Icon name="calendar" size={16} className="booking-summary-card__icon" />
                <h3>RESERVATION SUMMARY</h3>
              </div>

              <div className="booking-summary-list">
                <div className="booking-summary-item">
                  <span>Selected Service</span>
                  <strong>{selectedService?.name ?? "No service selected"}</strong>
                  <span className="booking-summary-item__meta">
                    Duration: {selectedService?.durationMinutes ? `${selectedService.durationMinutes} mins` : "—"}
                  </span>
                </div>

                <div className="booking-summary-item">
                  <span>Service Fee</span>
                  <strong className="highlight-price">
                    ₱{selectedService?.price.toLocaleString() ?? "0"}
                  </strong>
                </div>

                <div className="booking-summary-item">
                  <span>Preferred Barber</span>
                  <strong>
                    {selectedBarber
                      ? `${selectedBarber.firstName} ${selectedBarber.lastName}`
                      : "Any Available Master Barber"}
                  </strong>
                  <span className="booking-summary-item__certification">
                    <Icon name="star" size={11} />
                    TESDA NC II Certified
                  </span>
                </div>

                <div className="booking-summary-item">
                  <span>Date &amp; Time</span>
                  <strong>
                    {value.date ? value.date : "Select date"} · {value.time ? value.time : "Select time"}
                  </strong>
                </div>

                <div className="booking-summary-item">
                  <span>Location</span>
                  <strong className="booking-summary-item__location">Davao City HQ</strong>
                </div>
              </div>
            </div>

            {/* Barber Café Perks */}
            <div className="booking-perks-card">
              <div className="booking-perk-item">
                <div className="booking-perk-item__icon">
                  <Icon name="coffee" size={13} />
                </div>
                <div className="booking-perk-item__text">
                  <strong>Barber Café Experience</strong>
                  <span>Complimentary iced brew or specialty coffee while you relax.</span>
                </div>
              </div>

              <div className="booking-perk-item">
                <div className="booking-perk-item__icon">
                  <Icon name="clock" size={13} />
                </div>
                <div className="booking-perk-item__text">
                  <strong>10-Minute Grace Period</strong>
                  <span>We keep your chair reserved 10 minutes past your scheduled start.</span>
                </div>
              </div>

              <div className="booking-perk-item">
                <div className="booking-perk-item__icon">
                  <Icon name="phone" size={13} />
                </div>
                <div className="booking-perk-item__text">
                  <strong>Questions or Rescheduling?</strong>
                  <span>Hotline: (+63) 956 542 6212</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
