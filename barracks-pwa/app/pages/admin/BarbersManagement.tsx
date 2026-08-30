"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ViewId } from "@/app/types/domain";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { createInitials } from "@/app/utils/format";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type BarberForm = {
  firstName: string;
  lastName: string;
  specialty: string;
  status: ApiBarber["status"];
  commissionRate: string;
};

const emptyForm: BarberForm = {
  firstName: "",
  lastName: "",
  specialty: "Cuts + styling",
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

export function BarbersManagement({
  onToast,
  go,
}: {
  onToast: (message: string) => void;
  go: (view: ViewId) => void;
}) {
  const [items, setItems] = useState<ApiBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiBarber | null>(null);
  const [form, setForm] = useState<BarberForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

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
    setModalOpen(true);
  }

  function openEdit(barber: ApiBarber) {
    setEditing(barber);
    setForm({
      firstName: barber.firstName,
      lastName: barber.lastName,
      specialty: barber.specialty,
      status: barber.status,
      commissionRate: barber.commissionRate === null ? "" : String(barber.commissionRate),
    });
    setModalOpen(true);
  }

  async function saveBarber(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        specialty: form.specialty,
        status: form.status,
        commissionRate: form.commissionRate === "" ? null : Number(form.commissionRate),
      };
      const response = await apiRequest(editing ? `/api/barbers/${editing.id}` : "/api/barbers", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<{ success: boolean; barber?: ApiBarber; message?: string }>(response);
      if (!response.ok || !body?.success || !body.barber) throw new Error(body?.message ?? "Unable to save barber");
      const savedBarber = body.barber;
      setItems((current) => editing ? current.map((item) => item.id === savedBarber.id ? savedBarber : item) : [savedBarber, ...current]);
      setModalOpen(false);
      onToast(`${displayName(savedBarber)} ${editing ? "updated" : "added to the roster"}`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to save barber");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBarber(barber: ApiBarber) {
    if (!window.confirm(`Delete ${displayName(barber)} from the roster?`)) return;
    const response = await apiRequest(`/api/barbers/${barber.id}`, { method: "DELETE" });
    const body = await readApiBody<{ success: boolean; message?: string }>(response);
    if (!response.ok || !body?.success) {
      onToast(body?.message ?? "Unable to delete barber");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== barber.id));
    onToast(`${displayName(barber)} removed from the roster`);
  }

  const available = items.filter((item) => item.status === "available").length;
  const unavailable = items.filter((item) => item.status !== "available").length;

  return (
    <>
      <PageHeader title="Barber management" action={<Button icon="plus" onClick={openCreate}>Add barber</Button>} />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard label="Total barbers" value={String(items.length)} icon="scissors" accent="blue" />
        <MetricCard label="Available now" value={String(available)} icon="check" accent="green" />
        <MetricCard label="Busy or unavailable" value={String(unavailable)} icon="clock" accent="amber" />
      </div>

      <Panel className="barber-management-panel">
        <SectionHeading title="Barber roster" action={<Button variant="ghost" size="sm" iconAfter="arrowRight" onClick={() => go("barber-profile")}>Open profile view</Button>} />
        <div className="barber-management-list">
          {loading ? <div className="staff-table__empty">Loading barber profiles…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : items.length ? items.map((barber) => (
            <article className="barber-management-card" key={barber.id}>
              <div className="barber-management-card__intro">
                <Avatar initials={createInitials(displayName(barber))} tone="slate" size="lg" />
                <div>
                  <h3>{displayName(barber)}</h3>
                  <p>{barber.specialty}</p>
                  <small>Added {new Date(barber.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</small>
                </div>
                <Badge tone={statusTone(barber.status)}>{statusLabel(barber.status)}</Badge>
              </div>
              <div className="barber-management-card__stats">
                <span><small>Specialty</small><strong>{barber.specialty}</strong></span>
                <span><small>Commission</small><strong>{barber.commissionRate === null ? "Not set" : `${barber.commissionRate}%`}</strong></span>
                <span><small>Record type</small><strong>Business profile</strong></span>
              </div>
              <div className="barber-management-card__actions">
                <button className="row-action" type="button" onClick={() => openEdit(barber)}><Icon name="edit" size={14} /> Edit profile</button>
                <button className="row-action" type="button" onClick={() => go("barber-profile")}>View profile <Icon name="arrowRight" size={14} /></button>
                <button className="row-action row-action--danger" type="button" onClick={() => void deleteBarber(barber)}>Delete</button>
              </div>
            </article>
          )) : <EmptyState icon="scissors" title="No barbers yet" description="Add the first barber profile to start the operational roster." />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit barber profile" : "Add barber"} description="Barbers are business records managed by the shop team; they do not sign in." onClose={() => !submitting && setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveBarber}>
          <div className="form-grid form-grid--two">
            <TextField label="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            <TextField label="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </div>
          <TextField label="Specialty" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="Classic cuts + shaves" />
          <SelectField label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BarberForm["status"] })}>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="unavailable">Unavailable</option>
          </SelectField>
          <TextField label="Commission rate (optional)" type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={(event) => setForm({ ...form, commissionRate: event.target.value })} placeholder="e.g. 40" />
          <div className="modal-actions">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save profile"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
