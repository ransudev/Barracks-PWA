"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials, formatCurrency } from "@/app/utils/format";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
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

type BarberForm = {
  firstName: string;
  lastName: string;
  status: ApiBarber["status"];
  commissionRate: string;
  rating: string;
};

const emptyForm: BarberForm = {
  firstName: "",
  lastName: "",
  status: "available",
  commissionRate: "",
  rating: "",
};

function displayName(barber: ApiBarber): string {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

function statusLabel(status: ApiBarber["status"]): string {
  return status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
}

function statusTone(status: ApiBarber["status"]): "success" | "warning" | "neutral" {
  return status === "available" ? "success" : status === "busy" ? "warning" : "neutral";
}

function barberCommission(barber: ApiBarber): number | null {
  return barber.commissionRate === null ? null : barber.revenue * barber.commissionRate / 100;
}

function responseMessage(body: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): string {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return validationMessage || body?.message || fallback;
}

export function BarbersManagement({ onToast, canDelete, isAdministrator }: { onToast: (message: string) => void; canDelete: boolean; isAdministrator: boolean }) {
  const [items, setItems] = useState<ApiBarber[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApiBarber["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<ApiBarber | null>(null);
  const [selected, setSelected] = useState<ApiBarber | null>(null);
  const [form, setForm] = useState<BarberForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiBarber | null>(null);
  const [commissionRateDraft, setCommissionRateDraft] = useState("");
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);

  const loadBarbers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/barbers", { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
      if (!response.ok || !body?.success || !body.barbers) throw new Error(body?.message ?? "Unable to load barbers");
      setItems(body.barbers);
      setLoadError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load barbers";
      setLoadError(message);
      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadBarbers());
    return () => window.cancelAnimationFrame(frame);
  }, [loadBarbers]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(barber: ApiBarber) {
    setEditing(barber);
    setForm({ firstName: barber.firstName, lastName: barber.lastName, status: barber.status, commissionRate: barber.commissionRate === null ? "" : String(barber.commissionRate), rating: barber.rating === null ? "" : String(barber.rating) });
    setFormError("");
    setDetailsOpen(false);
    setModalOpen(true);
  }

  function viewDetails(barber: ApiBarber) {
    setSelected(barber);
    setDetailsOpen(true);
  }

  function closeEditor() {
    if (submitting) return;
    setModalOpen(false);
    setFormError("");
  }

  async function saveBarber(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      if (!firstName || !lastName) throw new Error("First and last name are required.");
      const commissionRate = form.commissionRate === "" ? null : Number(form.commissionRate);
      if (commissionRate !== null && (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)) throw new Error("Commission rate must be between 0 and 100.");
      const rating = form.rating === "" ? null : Number(form.rating);
      if (isAdministrator && rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5 || Math.abs(rating * 10 - Math.round(rating * 10)) > 1e-8)) throw new Error("Rating must be between 0 and 5 with up to 1 decimal place.");
      const payload = { firstName, lastName, status: form.status, commissionRate, ...(isAdministrator ? { rating } : {}) };
      const response = await apiRequest(editing ? `/api/barbers/${editing.id}` : "/api/barbers", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; barber?: ApiBarber; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.barber) throw new Error(responseMessage(body, "Unable to save barber"));
      const savedBarber = body.barber;
      setItems((current) => editing ? current.map((item) => item.id === savedBarber.id ? savedBarber : item) : [savedBarber, ...current]);
      setModalOpen(false);
      if (editing) {
        setSelected(savedBarber);
        setDetailsOpen(true);
      }
      onToast(`${displayName(savedBarber)} ${editing ? "updated" : "added"}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save barber");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBarber(barber: ApiBarber) {
    setDeletingId(barber.id);
    try {
      const response = await apiRequest(`/api/barbers/${barber.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to delete barber");
      setItems((current) => current.filter((item) => item.id !== barber.id));
      if (selected?.id === barber.id) {
        setSelected(null);
        setDetailsOpen(false);
      }
      onToast(`${displayName(barber)} removed from the roster`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to delete barber");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  function openCommissionRate() {
    setFormError("");
    const rates = [...new Set(items.map((barber) => barber.commissionRate).filter((rate): rate is number => rate !== null))];
    setCommissionRateDraft(rates.length === 1 ? String(rates[0]) : "");
    setCommissionModalOpen(true);
  }

  async function saveCommissionRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = Number(commissionRateDraft);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setFormError("Enter a commission rate between 0 and 100.");
      return;
    }
    if (!items.length) {
      setFormError("Add a barber before setting a commission rate.");
      return;
    }
    setFormError("");
    setCommissionSaving(true);
    try {
      const response = await apiRequest("/api/barbers", { method: "PATCH", body: JSON.stringify({ commissionRate: rate }) });
      const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.barbers) throw new Error(responseMessage(body, "Unable to update commission rates"));
      setItems(body.barbers);
      if (selected) setSelected(body.barbers.find((barber) => barber.id === selected.id) ?? selected);
      setCommissionModalOpen(false);
      onToast(`Commission rate set to ${rate}% for all barbers`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update commission rates");
    } finally {
      setCommissionSaving(false);
    }
  }

  const totalRevenue = items.reduce((total, barber) => total + barber.revenue, 0);
  const totalCommission = items.reduce((total, barber) => total + (barberCommission(barber) ?? 0), 0);
  const commissionRates = [...new Set(items.map((barber) => barber.commissionRate).filter((rate): rate is number => rate !== null))];
  const commissionRateLabel = commissionRates.length === 1 ? `${commissionRates[0]}%` : commissionRates.length ? "Mixed" : "—";
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = items.filter((barber) => `${displayName(barber)} ${barber.status} ${barber.commissionRate ?? ""}`.toLowerCase().includes(normalizedSearch) && (statusFilter === "all" || barber.status === statusFilter));

  return (
    <>
      <PageHeader title="Barber management" action={<><Button variant="secondary" iconAfter="chevronDown" onClick={openCommissionRate}>Set commission rate</Button><Button icon="plus" onClick={openCreate}>Add barber</Button></>} />
      <div className="metrics-grid metrics-grid--four"><MetricCard label="Total barbers" value={String(items.length)} icon="scissors" accent="blue" /><MetricCard label="Roster revenue" value={formatCurrency(totalRevenue)} icon="wallet" accent="green" /><MetricCard label="Commission rate" value={commissionRateLabel} icon="chart" accent="amber" /><MetricCard label="Total commission" value={formatCurrency(totalCommission)} icon="spark" accent="violet" /></div>

      <Panel className="staff-table-panel barber-crud-panel">
        <SectionHeading title="Barber records" action={<div className="panel-toolbar panel-toolbar--filters"><SearchInput value={search} onChange={setSearch} placeholder="Search barbers" /><SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ApiBarber["status"])} aria-label="Filter barbers by status"><option value="all">All statuses</option><option value="available">Available</option><option value="busy">Busy</option><option value="unavailable">Unavailable</option></SelectField></div>} />
        <div className="barber-table">
          <div className="barber-table__head"><span>Name</span><span>Status</span><span>Services</span><span>Revenue</span><span>Commission</span><span>Rating</span><span>Actions</span></div>
          {loading ? <div className="staff-table__empty" role="status">Loading barbers…</div> : loadError ? <div className="staff-table__empty" role="alert">{loadError}</div> : filtered.length ? filtered.map((barber) => <div className="barber-table__row" key={barber.id}>
            <span className="table-person"><Avatar initials={createInitials(displayName(barber))} tone="slate" size="sm" /><span><strong>{displayName(barber)}</strong><small>Barber #{barber.id}</small></span></span>
            <span><Badge tone={statusTone(barber.status)}>{statusLabel(barber.status)}</Badge></span><span>{barber.servicesDone}</span><span className="barber-table__revenue">{formatCurrency(barber.revenue)}</span><span className="barber-table__commission">{barber.commissionRate === null ? "—" : `${barber.commissionRate}%`}</span><span className="barber-table__rating">{barber.rating === null ? "—" : <><span>{barber.rating.toFixed(1)}</span><Icon name="star" size={13} /></>}</span>
            <span className="row-actions"><button className="row-action row-action--icon" type="button" onClick={() => viewDetails(barber)} aria-label={`View details for ${displayName(barber)}`} title={`View details for ${displayName(barber)}`}><Icon name="external" size={16} /></button><button className="row-action row-action--icon" type="button" onClick={() => openEdit(barber)} disabled={deletingId === barber.id} aria-label={`Edit ${displayName(barber)}`} title={`Edit ${displayName(barber)}`}><Icon name="edit" size={16} /></button>{canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => setPendingDelete(barber)} disabled={deletingId === barber.id} aria-label={`Delete ${displayName(barber)}`} title={`Delete ${displayName(barber)}`}><Icon name="trash" size={16} /></button>}</span>
          </div>) : <EmptyState icon="scissors" title="No barbers found" description="Add a barber or try a different search or status filter." action={<Button size="sm" icon="plus" onClick={openCreate}>Add barber</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit barber profile" : "Add barber"} onClose={closeEditor}>
        <form className="modal-form" onSubmit={saveBarber}><div className="form-grid form-grid--two"><TextField label="First name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} autoComplete="given-name" /><TextField label="Last name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div><SelectField label="Status" required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BarberForm["status"] })}><option value="available">Available</option><option value="busy">Busy</option><option value="unavailable">Unavailable</option></SelectField><div className="form-grid form-grid--two"><TextField label="Commission rate (optional)" type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} placeholder="e.g. 40" />{isAdministrator && <TextField label="Rating (optional)" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => setForm({ ...form, rating: event.target.value })} placeholder="e.g. 4.8" />}</div>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><Button variant="secondary" type="button" disabled={submitting} onClick={closeEditor}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</Button></div></form>
      </Modal>

      <Modal open={detailsOpen && Boolean(selected)} title={selected ? displayName(selected) : "Barber details"} onClose={() => setDetailsOpen(false)}>{selected && <div className="detail-modal"><div className="detail-modal__identity"><Avatar initials={createInitials(displayName(selected))} tone="slate" size="lg" /><div><strong>{displayName(selected)}</strong><span>Barber #{selected.id}</span></div></div><div className="detail-modal__rows"><div className="detail-modal__row"><span>Status</span><Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge></div><div className="detail-modal__row"><span>Commission rate</span><strong>{selected.commissionRate === null ? "Not set" : `${selected.commissionRate}%`}</strong></div><div className="detail-modal__row"><span>Services completed</span><strong>{selected.servicesDone}</strong></div><div className="detail-modal__row"><span>Revenue</span><strong>{formatCurrency(selected.revenue)}</strong></div><div className="detail-modal__row"><span>Commission earned</span><strong>{barberCommission(selected) === null ? "—" : formatCurrency(barberCommission(selected) ?? 0)}</strong></div><div className="detail-modal__row"><span>Rating</span><strong>{selected.rating === null ? "Not rated" : selected.rating.toFixed(1)}</strong></div></div><div className="modal-actions"><Button variant="secondary" icon="edit" onClick={() => openEdit(selected)}>Edit profile</Button></div></div>}</Modal>

      <Modal open={commissionModalOpen} title="Set commission rate" onClose={() => !commissionSaving && setCommissionModalOpen(false)}><form className="modal-form" onSubmit={saveCommissionRate}><TextField label="Commission rate (%)" required type="number" min="0" max="100" step="0.01" value={commissionRateDraft} onChange={(event) => setCommissionRateDraft(event.target.value)} placeholder="e.g. 30" />{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><Button variant="secondary" type="button" disabled={commissionSaving} onClick={() => setCommissionModalOpen(false)}>Cancel</Button><Button type="submit" icon="check" disabled={commissionSaving}>{commissionSaving ? "Saving…" : "Set rate"}</Button></div></form></Modal>

      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete this barber profile?" description={pendingDelete ? `${displayName(pendingDelete)} will be removed if no booking references the profile. Profiles referenced by bookings are protected.` : undefined} confirmLabel="Delete barber" danger busy={deletingId !== null} onClose={() => deletingId === null && setPendingDelete(null)} onConfirm={() => pendingDelete && void deleteBarber(pendingDelete)} />
    </>
  );
}
