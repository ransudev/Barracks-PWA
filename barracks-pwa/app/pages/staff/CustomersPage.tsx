"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ApiBarber, ApiCustomer } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials } from "@/app/utils/format";
import {
  Avatar,
  Button,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  preferredBarberId: string;
};

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  preferredBarberId: "",
};

function nameOf(customer: ApiCustomer) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function toProfilePayload(form: CustomerForm) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    preferredBarberId: form.preferredBarberId ? Number(form.preferredBarberId) : null,
  };
}

export function CustomersPage({ onToast }: { onToast: (message: string) => void }) {
  const [items, setItems] = useState<ApiCustomer[]>([]);
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<ApiCustomer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [customerResponse, barberResponse] = await Promise.all([apiRequest("/api/customers"), apiRequest("/api/barbers")]);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[]; message?: string }>(customerResponse);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        if (!customerResponse.ok || !customerBody?.success || !customerBody.customers) throw new Error(customerBody?.message ?? "Unable to load customers");
        setItems(customerBody.customers);
        setBarbers(barberBody?.barbers ?? []);
        setSelectedId(customerBody.customers[0] ? String(customerBody.customers[0].id) : "");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load customers";
        setLoadError(message);
        onToast(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const filtered = items.filter((customer) => `${nameOf(customer)} ${customer.email} ${customer.phone}`.toLowerCase().includes(search.toLowerCase()));
  const selected = items.find((customer) => String(customer.id) === selectedId) ?? items[0];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(customer: ApiCustomer) {
    setEditing(customer);
    setForm({ firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, password: "", preferredBarberId: customer.preferredBarberId ? String(customer.preferredBarberId) : "" });
    setModalOpen(true);
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = editing ? toProfilePayload(form) : { ...toProfilePayload(form), password: form.password };
      const response = await apiRequest(editing ? `/api/customers/${editing.id}` : "/api/customers", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(response);
      if (!response.ok || !body?.success || !body.customer) throw new Error(body?.message ?? "Unable to save customer");
      const savedCustomer = body.customer;
      setItems((current) => editing ? current.map((item) => item.id === savedCustomer.id ? savedCustomer : item) : [savedCustomer, ...current]);
      setSelectedId(String(savedCustomer.id));
      setModalOpen(false);
      onToast(`${nameOf(savedCustomer)} ${editing ? "updated" : "registered"}`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to save customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Customers" action={<Button icon="userPlus" onClick={openCreate}>Register customer</Button>} />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Customer accounts" value={String(items.length)} icon="users" accent="blue" />
        <MetricCard label="Preferred barber set" value={String(items.filter((item) => item.preferredBarberId !== null).length)} icon="scissors" accent="green" />
        <MetricCard label="Loyalty points" value={String(items.reduce((total, item) => total + item.loyaltyPoints, 0))} icon="spark" accent="amber" />
      </div>

      <div className="customer-workspace">
        <Panel className="customer-list-panel">
          <SectionHeading title="Customer list" action={<SearchInput value={search} onChange={setSearch} placeholder="Search customers" />} />
          <div className="customer-list">
            {loading ? <div className="staff-table__empty">Loading customers…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : filtered.length ? filtered.map((customer) => <button type="button" className={`customer-list__row ${selectedId === String(customer.id) ? "is-active" : ""}`} key={customer.id} onClick={() => setSelectedId(String(customer.id))}>
              <Avatar initials={createInitials(nameOf(customer))} tone="slate" size="sm" />
              <span><strong>{nameOf(customer)}</strong><small>{customer.phone || "No phone on file"}</small></span>
              <span className="customer-list__stats"><strong>{customer.loyaltyPoints} pts</strong><small>account</small></span>
              <Icon name="chevronRight" size={15} />
            </button>) : <EmptyState title="No customers found" description="Register a customer account or try a different search." />}
          </div>
        </Panel>

        {selected ? <Panel className="customer-detail-panel">
          <div className="customer-detail__head"><div className="table-person"><Avatar initials={createInitials(nameOf(selected))} tone="slate" size="lg" /><span><strong>{nameOf(selected)}</strong><small>Customer account</small></span></div><Button variant="secondary" size="sm" icon="edit" onClick={() => openEdit(selected)}>Edit profile</Button></div>
          <div className="customer-detail__facts">
            <span><small>Email</small><strong>{selected.email}</strong></span>
            <span><small>Phone</small><strong>{selected.phone || "Not set"}</strong></span>
            <span><small>Preferred barber</small><strong>{selected.preferredBarberName ?? "Not set"}</strong></span>
            <span><small>Loyalty points</small><strong className="text-amber">{selected.loyaltyPoints} pts</strong></span>
          </div>
          <div className="customer-detail__history"><SectionHeading title="Visit history" /><EmptyState title="No visits recorded" description="Visit history stays empty until booking and transaction systems are added." /></div>
        </Panel> : <Panel className="customer-detail-panel"><EmptyState icon="users" title="No customer selected" description="Register a customer to open their profile." /></Panel>}
      </div>

      <Modal open={modalOpen} title={editing ? "Edit customer profile" : "Register customer"} description={editing ? "Update the customer record and preferred barber." : "Create a customer login and shop profile together."} onClose={() => !submitting && setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveCustomer}>
          <div className="form-grid form-grid--two"><TextField label="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /><TextField label="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div>
          <TextField label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} icon="mail" />
          <TextField label="Phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} icon="phone" />
          {!editing && <TextField label="Temporary password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" icon="lock" />}
          <SelectField label="Preferred barber" value={form.preferredBarberId} onChange={(event) => setForm({ ...form, preferredBarberId: event.target.value })}><option value="">Not set</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField>
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Create customer"}</Button></div>
        </form>
      </Modal>
    </>
  );
}
