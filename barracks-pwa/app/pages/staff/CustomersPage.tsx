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
  loyaltyPoints: string;
  password: string;
  preferredBarberId: string;
};

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  loyaltyPoints: "0",
  password: "",
  preferredBarberId: "",
};

function nameOf(customer: ApiCustomer) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function toCustomerPayload(form: CustomerForm) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    preferredBarberId: form.preferredBarberId ? Number(form.preferredBarberId) : null,
  };
}

function responseMessage(
  body: { message?: string; errors?: Record<string, string[]> } | null,
  fallback: string,
) {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return validationMessage || body?.message || fallback;
}

function formatMemberSince(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function CustomersPage({ onToast, canDelete, isAdministrator }: { onToast: (message: string) => void; canDelete: boolean; isAdministrator: boolean }) {
  const [items, setItems] = useState<ApiCustomer[]>([]);
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ApiCustomer | null>(null);
  const [selected, setSelected] = useState<ApiCustomer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [customerResponse, barberResponse] = await Promise.all([apiRequest("/api/customers"), apiRequest("/api/barbers")]);
        const customerBody = await readApiBody<{ success: boolean; customers?: ApiCustomer[]; message?: string }>(customerResponse);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        if (!customerResponse.ok || !customerBody?.success || !customerBody.customers) throw new Error(customerBody?.message ?? "Unable to load customers");
        if (cancelled) return;
        setItems(customerBody.customers);
        setBarbers(barberBody?.barbers ?? []);
        setLoadError("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load customers";
        if (!cancelled) {
          setLoadError(message);
          onToast(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [onToast]);

  const filtered = items.filter((customer) => `${nameOf(customer)} ${customer.email} ${customer.phone}`.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(customer: ApiCustomer) {
    setEditing(customer);
    setForm({ firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, loyaltyPoints: String(customer.loyaltyPoints), password: "", preferredBarberId: customer.preferredBarberId ? String(customer.preferredBarberId) : "" });
    setFormError("");
    setDetailsOpen(false);
    setModalOpen(true);
  }

  function viewDetails(customer: ApiCustomer) {
    setSelected(customer);
    setDetailsOpen(true);
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const loyaltyPoints = Number(form.loyaltyPoints);
      if (isAdministrator && (!Number.isSafeInteger(loyaltyPoints) || loyaltyPoints < 0 || loyaltyPoints > 2147483647)) {
        throw new Error("Loyalty points must be a non-negative whole number.");
      }
      const payload = editing
        ? isAdministrator ? { ...toCustomerPayload(form), loyaltyPoints } : toCustomerPayload(form)
        : { ...toCustomerPayload(form), password: form.password };
      const response = await apiRequest(editing ? `/api/customers/${editing.id}` : "/api/customers", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.customer) throw new Error(responseMessage(body, "Unable to save customer"));
      const savedCustomer = body.customer;
      setItems((current) => editing ? current.map((item) => item.id === savedCustomer.id ? savedCustomer : item) : [savedCustomer, ...current]);
      setModalOpen(false);
      if (editing) {
        setSelected(savedCustomer);
        setDetailsOpen(true);
      }
      onToast(`${nameOf(savedCustomer)} ${editing ? "updated" : "created"}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save customer");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCustomer(customer: ApiCustomer) {
    if (!window.confirm(`Delete ${nameOf(customer)}? The customer account will be deactivated and its record retained.`)) return;

    setDeletingId(customer.id);
    try {
      const response = await apiRequest(`/api/customers/${customer.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to delete customer");
      setItems((current) => current.filter((item) => item.id !== customer.id));
      if (selected?.id === customer.id) {
        setSelected(null);
        setDetailsOpen(false);
      }
      onToast(`${nameOf(customer)} deleted; the customer record was retained`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to delete customer");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Customer management" action={<Button icon="userPlus" onClick={openCreate}>Add customer</Button>} />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Customer accounts" value={String(items.length)} icon="users" accent="blue" />
        <MetricCard label="Preferred barber set" value={String(items.filter((item) => item.preferredBarberId !== null).length)} icon="scissors" accent="green" />
        <MetricCard label="Loyalty points" value={String(items.reduce((total, item) => total + item.loyaltyPoints, 0))} icon="spark" accent="amber" />
      </div>

      <Panel className="staff-table-panel customer-crud-panel">
        <SectionHeading title="Customer records" action={<SearchInput value={search} onChange={setSearch} placeholder="Search customers" />} />
        <div className="customer-table">
          <div className="customer-table__head">
            <span>Name</span>
            <span>Contact</span>
            <span>Preferred barber</span>
            <span>Loyalty</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>
          {loading ? <div className="staff-table__empty">Loading customers…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : filtered.length ? filtered.map((customer) => (
            <div className="customer-table__row" key={customer.id}>
              <span className="table-person">
                <Avatar initials={createInitials(nameOf(customer))} tone="slate" size="sm" />
                <span><strong>{nameOf(customer)}</strong><small>Customer #{customer.id}</small></span>
              </span>
              <span className="customer-table__contact"><strong>{customer.email}</strong><small>{customer.phone || "No phone on file"}</small></span>
              <span>{customer.preferredBarberName ?? "Not set"}</span>
              <span className="customer-table__points">{customer.loyaltyPoints} pts</span>
              <span>{formatMemberSince(customer.createdAt)}</span>
              <span className="row-actions">
                <button className="row-action row-action--icon" type="button" onClick={() => viewDetails(customer)} disabled={deletingId === customer.id} aria-label={`View profile for ${nameOf(customer)}`} title={`View profile for ${nameOf(customer)}`}><Icon name="external" size={16} /></button>
                <button className="row-action row-action--icon" type="button" onClick={() => openEdit(customer)} disabled={deletingId === customer.id} aria-label={`Edit ${nameOf(customer)}`} title={`Edit ${nameOf(customer)}`}><Icon name="edit" size={16} /></button>
                {canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => void deleteCustomer(customer)} disabled={deletingId === customer.id} aria-label={`${deletingId === customer.id ? "Deleting" : "Delete"} ${nameOf(customer)}`} title={`${deletingId === customer.id ? "Deleting" : "Delete"} ${nameOf(customer)}`}><Icon name={deletingId === customer.id ? "refresh" : "trash"} size={16} /></button>}
              </span>
            </div>
          )) : <EmptyState icon="users" title="No customers found" description="Add a customer or try a different search." action={<Button size="sm" icon="userPlus" onClick={openCreate}>Add customer</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit customer" : "Add customer"} onClose={() => !submitting && setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveCustomer}>
          <div className="form-grid form-grid--two"><TextField label="First name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /><TextField label="Last name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
          <TextField label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} icon="mail" />
          <TextField label="Phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} icon="phone" />
          {editing && isAdministrator && <TextField label="Loyalty points" type="number" min="0" max="2147483647" step="1" required value={form.loyaltyPoints} onChange={(event) => setForm({ ...form, loyaltyPoints: event.target.value })} />}
          {!editing && <TextField label="Temporary password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" icon="lock" />}
          <SelectField label="Preferred barber" value={form.preferredBarberId} onChange={(event) => setForm({ ...form, preferredBarberId: event.target.value })}><option value="">Not set</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField>
          {formError && <p className="form-error">{formError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Create customer"}</Button></div>
        </form>
      </Modal>

      <Modal open={detailsOpen && Boolean(selected)} title={selected ? nameOf(selected) : "Customer profile"} onClose={() => setDetailsOpen(false)}>
        {selected && <div className="detail-modal"><div className="detail-modal__identity"><Avatar initials={createInitials(nameOf(selected))} tone="slate" size="lg" /><div><strong>{nameOf(selected)}</strong><span>Customer #{selected.id}</span></div></div><div className="detail-modal__rows"><div className="detail-modal__row"><span>Email</span><strong>{selected.email}</strong></div><div className="detail-modal__row"><span>Phone</span><strong>{selected.phone || "No phone on file"}</strong></div><div className="detail-modal__row"><span>Preferred barber</span><strong>{selected.preferredBarberName ?? "Not set"}</strong></div><div className="detail-modal__row"><span>Loyalty points</span><strong>{selected.loyaltyPoints}</strong></div><div className="detail-modal__row"><span>Member since</span><strong>{formatMemberSince(selected.createdAt)}</strong></div></div><div className="modal-actions"><Button variant="secondary" icon="edit" onClick={() => openEdit(selected)}>Edit profile</Button></div></div>}
      </Modal>
    </>
  );
}
