"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials, formatCurrency } from "@/app/utils/format";
import {
  Avatar,
  Badge,
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

type BarberForm = {
  firstName: string;
  lastName: string;
  status: ApiBarber["status"];
  commissionRate: string;
};

const emptyForm: BarberForm = {
  firstName: "",
  lastName: "",
  status: "available",
  commissionRate: "",
};

function displayName(barber: ApiBarber) {
  return `${barber.firstName} ${barber.lastName}`.trim();
}

function statusLabel(status: ApiBarber["status"]) {
  return status === "available" ? "Available" : status === "busy" ? "Busy" : "Unavailable";
}

function statusTone(status: ApiBarber["status"]): "success" | "warning" | "neutral" {
  return status === "available" ? "success" : status === "busy" ? "warning" : "neutral";
}

function barberCommission(barber: ApiBarber) {
  return barber.commissionRate === null ? null : barber.revenue * barber.commissionRate / 100;
}

function responseMessage(
  body: { message?: string; errors?: Record<string, string[]> } | null,
  fallback: string,
) {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return validationMessage || body?.message || fallback;
}

export function BarbersManagement({
  onToast,
  canDelete,
}: {
  onToast: (message: string) => void;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<ApiBarber[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiBarber | null>(null);
  const [form, setForm] = useState<BarberForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [commissionRateDraft, setCommissionRateDraft] = useState("");
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadBarbers() {
      try {
        const response = await apiRequest("/api/barbers");
        const body = await readApiBody<{ success: boolean; barbers?: ApiBarber[]; message?: string }>(response);
        if (!response.ok || !body?.success || !body.barbers) throw new Error(body?.message ?? "Unable to load barbers");
        if (!cancelled) {
          setItems(body.barbers);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load barbers";
          setLoadError(message);
          onToast(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBarbers();
    return () => { cancelled = true; };
  }, [onToast]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(barber: ApiBarber) {
    setEditing(barber);
    setForm({
      firstName: barber.firstName,
      lastName: barber.lastName,
      status: barber.status,
      commissionRate: barber.commissionRate === null ? "" : String(barber.commissionRate),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function saveBarber(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        status: form.status,
        commissionRate: form.commissionRate === "" ? null : Number(form.commissionRate),
      };
      const response = await apiRequest(editing ? `/api/barbers/${editing.id}` : "/api/barbers", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<{ success: boolean; barber?: ApiBarber; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.barber) throw new Error(responseMessage(body, "Unable to save barber"));
      const savedBarber = body.barber;
      setItems((current) => editing ? current.map((item) => item.id === savedBarber.id ? savedBarber : item) : [savedBarber, ...current]);
      setModalOpen(false);
      onToast(`${displayName(savedBarber)} ${editing ? "updated" : "added"}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save barber");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBarber(barber: ApiBarber) {
    if (!window.confirm(`Delete ${displayName(barber)} from the roster?`)) return;
    setDeletingId(barber.id);
    try {
      const response = await apiRequest(`/api/barbers/${barber.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to delete barber");
      setItems((current) => current.filter((item) => item.id !== barber.id));
      onToast(`${displayName(barber)} removed from the roster`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to delete barber");
    } finally {
      setDeletingId(null);
    }
  }

  function openCommissionRate() {
    const rates = [...new Set(items.map((barber) => barber.commissionRate).filter((rate): rate is number => rate !== null))];
    setCommissionRateDraft(rates.length === 1 ? String(rates[0]) : "");
    setCommissionModalOpen(true);
  }

  async function saveCommissionRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = Number(commissionRateDraft);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      onToast("Enter a commission rate between 0 and 100");
      return;
    }
    if (!items.length) {
      onToast("Add a barber before setting a commission rate");
      return;
    }

    setCommissionSaving(true);
    try {
      const responses = await Promise.all(items.map((barber) => apiRequest(`/api/barbers/${barber.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: barber.firstName,
          lastName: barber.lastName,
          status: barber.status,
          commissionRate: rate,
        }),
      })));
      const bodies = await Promise.all(responses.map((response) => readApiBody<{ success: boolean; barber?: ApiBarber; message?: string }>(response)));
      const failed = bodies.find((body, index) => !responses[index].ok || !body?.success || !body.barber);
      if (failed) throw new Error(failed.message ?? "Unable to update commission rate");

      setItems(bodies.map((body) => body!.barber!));
      setCommissionModalOpen(false);
      onToast(`Commission rate set to ${rate}%`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update commission rate");
    } finally {
      setCommissionSaving(false);
    }
  }

  const totalRevenue = items.reduce((total, barber) => total + barber.revenue, 0);
  const totalCommission = items.reduce((total, barber) => total + (barberCommission(barber) ?? 0), 0);
  const commissionRates = [...new Set(items.map((barber) => barber.commissionRate).filter((rate): rate is number => rate !== null))];
  const commissionRateLabel = commissionRates.length === 1 ? `${commissionRates[0]}%` : commissionRates.length ? "Mixed" : "—";
  const filtered = items.filter((barber) => `${displayName(barber)} ${barber.status} ${barber.commissionRate ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Barber management"
        description="Create, update, and manage the barber roster."
        action={<><Button variant="secondary" iconAfter="chevronDown" onClick={openCommissionRate}>Set commission rate</Button><Button icon="plus" onClick={openCreate}>Add barber</Button></>}
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard label="Total Barbers" value={String(items.length)} icon="scissors" accent="blue" />
        <MetricCard label="This Week Revenue" value={formatCurrency(totalRevenue)} icon="wallet" accent="green" />
        <MetricCard label="Commission Rate" value={commissionRateLabel} icon="chart" accent="amber" />
        <MetricCard label="Total Commission" value={formatCurrency(totalCommission)} icon="spark" accent="violet" />
      </div>

      <Panel className="staff-table-panel barber-crud-panel">
        <SectionHeading title="Barber records" description="Manage roster details and compensation data." action={<SearchInput value={search} onChange={setSearch} placeholder="Search barbers" />} />
        <div className="barber-table">
          <div className="barber-table__head">
            <span>Name</span>
            <span>Status</span>
            <span>Services</span>
            <span>Revenue</span>
            <span>Commission</span>
            <span>Rating</span>
            <span>Actions</span>
          </div>
          {loading ? <div className="staff-table__empty">Loading barbers…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : filtered.length ? filtered.map((barber) => (
            <div className="barber-table__row" key={barber.id}>
              <span className="table-person">
                <Avatar initials={createInitials(displayName(barber))} tone="slate" size="sm" />
                <span><strong>{displayName(barber)}</strong><small>Barber #{barber.id}</small></span>
              </span>
              <span><Badge tone={statusTone(barber.status)}>{statusLabel(barber.status)}</Badge></span>
              <span>{barber.servicesDone}</span>
              <span className="barber-table__revenue">{formatCurrency(barber.revenue)}</span>
              <span className="barber-table__commission">{barber.commissionRate === null ? "—" : `${barber.commissionRate}%`}</span>
              <span className="barber-table__rating">{barber.rating === null ? "—" : <><span>{barber.rating.toFixed(1)}</span><Icon name="star" size={13} /></>}</span>
              <span className="row-actions">
                <button className="row-action row-action--icon" type="button" onClick={() => openEdit(barber)} disabled={deletingId === barber.id} aria-label={`Edit ${displayName(barber)}`} title={`Edit ${displayName(barber)}`}><Icon name="edit" size={16} /></button>
                {canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => void deleteBarber(barber)} disabled={deletingId === barber.id} aria-label={`${deletingId === barber.id ? "Deleting" : "Delete"} ${displayName(barber)}`} title={`${deletingId === barber.id ? "Deleting" : "Delete"} ${displayName(barber)}`}><Icon name={deletingId === barber.id ? "refresh" : "trash"} size={16} /></button>}
              </span>
            </div>
          )) : <EmptyState icon="scissors" title="No barbers found" description="Add a barber or try a different search." action={<Button size="sm" icon="plus" onClick={openCreate}>Add barber</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit barber" : "Add barber"} description="Barbers are business records managed by the shop team; they do not sign in." onClose={() => !submitting && setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveBarber}>
          <div className="form-grid form-grid--two">
            <TextField label="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            <TextField label="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </div>
          <SelectField label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BarberForm["status"] })}>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="unavailable">Unavailable</option>
          </SelectField>
          <TextField label="Commission rate (optional)" type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} placeholder="e.g. 40" />
          {formError && <p className="form-error">{formError}</p>}
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={commissionModalOpen} title="Set Commission Rate" description="Apply one rate to every barber record." onClose={() => !commissionSaving && setCommissionModalOpen(false)}>
        <form className="modal-form" onSubmit={saveCommissionRate}>
          <TextField label="Commission rate (%)" type="number" min="0" max="100" step="0.5" value={commissionRateDraft} onChange={(event) => setCommissionRateDraft(event.target.value)} placeholder="e.g. 30" />
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={() => setCommissionModalOpen(false)}>Cancel</Button>
            <Button type="submit" icon="check" disabled={commissionSaving}>{commissionSaving ? "Saving…" : "Set rate"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
