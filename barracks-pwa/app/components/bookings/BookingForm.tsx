import { useEffect, useState, type FormEvent } from "react";
import type { ApiBarberAvailability, ApiCustomer } from "@/app/lib/api";
import type { Service } from "@/app/types/domain";
import { Button, SelectField, TextField } from "@/app/components/ui";
import { dateInputValue } from "@/app/utils/format";
import { apiRequest, readApiBody } from "@/app/lib/api";

export type BookingFormValue = {
  customerId: string;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
  notes: string;
};

export function BookingForm({
  value,
  customers = [],
  services,
  barbers,
  hideCustomer = false,
  excludeBookingId,
  availabilityVersion = 0,
  submitLabel = "Save booking",
  submitting = false,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: BookingFormValue;
  customers?: ApiCustomer[];
  services: Service[];
  barbers: ApiBarberAvailability[];
  hideCustomer?: boolean;
  excludeBookingId?: number;
  availabilityVersion?: number;
  submitLabel?: string;
  submitting?: boolean;
  onChange: (value: BookingFormValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityReason, setAvailabilityReason] = useState<"schedule_not_configured" | null>(null);
  const { serviceId, barberId, date } = value;
  useEffect(() => {
    if (!serviceId || !date) return;
    let active = true;
    const params = new URLSearchParams({ serviceId, date });
    if (barberId) params.set("barberId", barberId);
    if (excludeBookingId) params.set("excludeBookingId", String(excludeBookingId));
    async function load() {
      setLoading(true);
      setAvailabilityError("");
      setAvailabilityReason(null);
      try {
        const response = await apiRequest(`/api/bookings/availability?${params}`, { cache: "no-store" });
        const body = await readApiBody<{ success: boolean; slots?: { startTime: string; endTime: string }[]; reason?: "schedule_not_configured"; message?: string }>(response);
        if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load available times");
        if (active) { setSlots(body.slots ?? []); setAvailabilityReason(body.reason ?? null); }
      } catch (error) {
        if (active) { setSlots([]); setAvailabilityError(error instanceof Error ? error.message : "Unable to load available times"); }
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [serviceId, barberId, date, excludeBookingId, availabilityVersion]);
  const selectedSlot = slots.find((slot) => slot.startTime === value.time);
  const selectedService = services.find((service) => service.id === value.serviceId);
  const selectedBarber = barbers.find((barber) => String(barber.id) === value.barberId);
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      {!hideCustomer && (
        <SelectField label="Customer" required value={value.customerId} onChange={(event) => onChange({ ...value, customerId: event.target.value })}>
          <option value="">Choose a customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}
        </SelectField>
      )}
      <SelectField label="Service" required value={value.serviceId} onChange={(event) => onChange({ ...value, serviceId: event.target.value, time: "" })}>
        <option value="">Choose a service</option>
        {services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} mins · ₱{service.price}</option>)}
      </SelectField>
      <SelectField label="Barber" value={value.barberId} onChange={(event) => onChange({ ...value, barberId: event.target.value, time: "" })}>
        <option value="">Any Available Barber</option>
        {barbers.filter((barber) => barber.status !== "unavailable").map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}
      </SelectField>
      <div className="form-grid form-grid--two">
        <TextField label="Date" required type="date" value={value.date} min={dateInputValue()} onChange={(event) => onChange({ ...value, date: event.target.value, time: "" })} />
        <SelectField label="Available time" required value={selectedSlot ? value.time : ""} disabled={loading || !slots.length} onChange={(event) => onChange({ ...value, time: event.target.value })}>
          <option value="">{loading ? "Loading available times…" : slots.length ? "Choose a time" : "No available times"}</option>
          {slots.map((slot) => <option key={slot.startTime} value={slot.startTime}>{slot.startTime}–{slot.endTime}</option>)}
        </SelectField>
      </div>
      {availabilityError && <p role="alert" className="form-hint">{availabilityError}</p>}
      {!loading && !availabilityError && !slots.length && <p className="form-hint">{availabilityReason === "schedule_not_configured" ? "This barber's schedule is not ready yet. Try another barber or ask the shop for help." : "No slots are available for this selection. Try another date or barber."}</p>}
      <TextField label="Notes (optional)" value={value.notes} maxLength={500} onChange={(event) => onChange({ ...value, notes: event.target.value })} />
      {selectedSlot && selectedService && <div className="booking-form-review" aria-label="Review booking">
        <h3>Review appointment</h3>
        <p>{selectedService.name} · {selectedService.durationMinutes} minutes · ₱{selectedService.price}</p>
        <p>{selectedBarber ? `${selectedBarber.firstName} ${selectedBarber.lastName}` : "Any Available Barber"} · {value.date} · {selectedSlot.startTime}–{selectedSlot.endTime}</p>
        <p>Notes: {value.notes.trim() || "None"}</p>
      </div>}
      <div className="modal-actions">
        <Button variant="secondary" type="button" disabled={submitting} onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon="calendar" disabled={submitting || loading || !selectedSlot || Boolean(availabilityError)}>{submitting ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
