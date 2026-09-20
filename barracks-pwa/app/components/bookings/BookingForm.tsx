import type { FormEvent } from "react";
import type { ApiBarberAvailability, ApiCustomer } from "@/app/lib/api";
import type { Service } from "@/app/types/domain";
import { Button, SelectField, TextField } from "@/app/components/ui";
import { dateInputValue } from "@/app/utils/format";

export type BookingFormValue = {
  customerId: string;
  serviceId: string;
  barberId: string;
  date: string;
  time: string;
};

export function BookingForm({
  value,
  customers = [],
  services,
  barbers,
  hideCustomer = false,
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
  submitLabel?: string;
  submitting?: boolean;
  onChange: (value: BookingFormValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      {!hideCustomer && (
        <SelectField label="Customer" required value={value.customerId} onChange={(event) => onChange({ ...value, customerId: event.target.value })}>
          <option value="">Choose a customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>)}
        </SelectField>
      )}
      <SelectField label="Service" required value={value.serviceId} onChange={(event) => onChange({ ...value, serviceId: event.target.value })}>
        <option value="">Choose a service</option>
        {services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration}</option>)}
      </SelectField>
      <SelectField label="Barber" required value={value.barberId} onChange={(event) => onChange({ ...value, barberId: event.target.value })}>
        <option value="">Choose a barber</option>
        {barbers.filter((barber) => barber.status !== "unavailable").map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}
      </SelectField>
      <div className="form-grid form-grid--two">
        <TextField label="Date" required type="date" value={value.date} min={dateInputValue()} onChange={(event) => onChange({ ...value, date: event.target.value })} />
        <TextField label="Time" required type="time" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value })} />
      </div>
      <div className="modal-actions">
        <Button variant="secondary" type="button" disabled={submitting} onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon="calendar" disabled={submitting}>{submitting ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
