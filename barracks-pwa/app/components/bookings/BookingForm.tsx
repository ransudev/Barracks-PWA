import type { FormEvent } from "react";
import type { Barber, Customer, Service } from "@/app/types/domain";
import { Button, SelectField, TextField } from "@/app/components/ui";

export type BookingFormValue = {
  customer: string;
  service: string;
  barber: string;
  time: string;
  meridiem: string;
};

export function BookingForm({ value, customers, services, barbers, submitLabel = "Save booking", onChange, onSubmit, onCancel }: {
  value: BookingFormValue;
  customers: Customer[];
  services: Service[];
  barbers: Barber[];
  submitLabel?: string;
  onChange: (value: BookingFormValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <SelectField label="Customer" value={value.customer} onChange={(event) => onChange({ ...value, customer: event.target.value })}>
        {customers.map((customer) => <option key={customer.id}>{customer.name}</option>)}
      </SelectField>
      <SelectField label="Service" value={value.service} onChange={(event) => onChange({ ...value, service: event.target.value })}>
        {services.filter((service) => service.active).map((service) => <option key={service.id}>{service.name}</option>)}
      </SelectField>
      <SelectField label="Barber" value={value.barber} onChange={(event) => onChange({ ...value, barber: event.target.value })}>
        {barbers.map((barber) => <option key={barber.id}>{barber.name}</option>)}
      </SelectField>
      <div className="form-grid form-grid--two">
        <TextField label="Time" type="time" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value })} />
        <SelectField label="Period" value={value.meridiem} onChange={(event) => onChange({ ...value, meridiem: event.target.value })}>
          <option>AM</option><option>PM</option>
        </SelectField>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" icon="calendar">{submitLabel}</Button>
      </div>
    </form>
  );
}
