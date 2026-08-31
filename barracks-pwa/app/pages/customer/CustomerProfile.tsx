"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ApiBarber, ApiCustomer } from "@/app/lib/api";
import { apiRequest, readApiBody, type ApiUser } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { Avatar, Badge, Button, EmptyState, Logo, Modal, Panel, SectionHeading, SelectField, TextField } from "@/app/components/ui";
import { createInitials } from "@/app/utils/format";
import { Icon } from "@/app/components/ui/icons";

export function CustomerTopbar({ go, active, onSignOut, user }: { go: (view: ViewId) => void; active: ViewId; onSignOut: () => void; user?: ApiUser | null }) {
  return <header className="customer-topbar"><Logo onClick={() => go("landing")} /><nav className="customer-topbar__links" aria-label="Customer navigation"><button type="button" className={active === "customer-dashboard" ? "is-active" : ""} onClick={() => go("customer-dashboard")}>Dashboard</button><button type="button" className={active === "customer-booking" ? "is-active" : ""} onClick={() => go("customer-booking")}>Book</button><button type="button" className={active === "customer-profile" ? "is-active" : ""} onClick={() => go("customer-profile")}>Profile</button><span>{user ? `${user.firstName} ${user.lastName}` : "Customer account"}</span><button type="button" onClick={onSignOut}>Sign out <Icon name="logOut" size={14} /></button></nav></header>;
}

function CustomerFrame({ children, go, active, onSignOut, user }: { children: ReactNode; go: (view: ViewId) => void; active: ViewId; onSignOut: () => void; user?: ApiUser | null }) {
  return <div className="customer-page"><CustomerTopbar go={go} active={active} onSignOut={onSignOut} user={user} /><main className="customer-content">{children}</main></div>;
}

function profileForm(customer: ApiCustomer) {
  return { firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, preferredBarberId: customer.preferredBarberId ? String(customer.preferredBarberId) : "" };
}

export function CustomerProfile({ go, onToast, onSignOut, user }: { go: (view: ViewId) => void; onToast: (message: string) => void; onSignOut: () => void; user: ApiUser }) {
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [barbers, setBarbers] = useState<ApiBarber[]>([]);
  const [draft, setDraft] = useState({ firstName: "", lastName: "", email: "", phone: "", preferredBarberId: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [customerResponse, barberResponse] = await Promise.all([apiRequest("/api/customers/me"), apiRequest("/api/barbers")]);
        const customerBody = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(customerResponse);
        const barberBody = await readApiBody<{ success: boolean; barbers?: ApiBarber[] }>(barberResponse);
        if (!customerResponse.ok || !customerBody?.success || !customerBody.customer) throw new Error(customerBody?.message ?? "Unable to load your profile");
        setCustomer(customerBody.customer);
        setDraft(profileForm(customerBody.customer));
        setBarbers(barberBody?.barbers ?? []);
      } catch (error) {
        onToast(error instanceof Error ? error.message : "Unable to load your profile");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiRequest("/api/customers/me", { method: "PUT", body: JSON.stringify({ ...draft, preferredBarberId: draft.preferredBarberId ? Number(draft.preferredBarberId) : null }) });
      const body = await readApiBody<{ success: boolean; customer?: ApiCustomer; message?: string }>(response);
      if (!response.ok || !body?.success || !body.customer) throw new Error(body?.message ?? "Unable to update your profile");
      setCustomer(body.customer);
      setDraft(profileForm(body.customer));
      setEditing(false);
      onToast("Profile updated");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update your profile");
    } finally {
      setSaving(false);
    }
  }

  const name = customer ? `${customer.firstName} ${customer.lastName}` : "Your profile";
  return <CustomerFrame go={go} active="customer-profile" onSignOut={onSignOut} user={user}>
    <div className="customer-profile-page"><div className="customer-profile-page__heading"><div><p className="customer-page__eyebrow">Customer profile</p><h1>{name}</h1><p>Keep your contact details and barber preference up to date.</p></div>{customer && <Button icon="edit" onClick={() => { setDraft(profileForm(customer)); setEditing(true); }}>Edit profile</Button>}</div>
      {loading ? <Panel><div className="staff-table__empty">Loading your profile…</div></Panel> : customer ? <><Panel className="customer-profile-card"><div className="customer-profile-card__identity"><Avatar initials={createInitials(name)} tone="slate" size="xl" /><div><h2>{name}</h2><p>{customer.email}</p><Badge tone="neutral">Customer account</Badge></div></div><div className="customer-profile-card__facts"><div><small>Phone</small><strong>{customer.phone || "Not set"}</strong></div><div><small>Preferred barber</small><strong>{customer.preferredBarberName ?? "Not set"}</strong></div><div><small>Loyalty points</small><strong>{customer.loyaltyPoints}</strong></div><div><small>Member since</small><strong>{new Date(customer.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</strong></div></div></Panel><Panel><SectionHeading title="Visit history" /><EmptyState title="No visits recorded" description="Visit history will appear here when booking and transaction features are added." /></Panel></> : <Panel><EmptyState icon="users" title="Profile unavailable" description="Sign out and sign in again to reload your customer account." /></Panel>}
    </div>
    <Modal open={editing} title="Edit your profile" description="Only your own customer record can be updated here." onClose={() => !saving && setEditing(false)}><form className="modal-form" onSubmit={saveProfile}><div className="form-grid form-grid--two"><TextField label="First name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /><TextField label="Last name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></div><TextField label="Email address" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} icon="mail" /><TextField label="Phone number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} icon="phone" /><SelectField label="Preferred barber" value={draft.preferredBarberId} onChange={(event) => setDraft({ ...draft, preferredBarberId: event.target.value })}><option value="">Not set</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</SelectField><div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" icon="check" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div></form></Modal>
  </CustomerFrame>;
}
