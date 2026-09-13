"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Badge, Button, EmptyState, MetricCard, Panel, SectionHeading, TextField } from "@/app/components/ui";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";

type SupplierProfileResponse = {
  success: boolean;
  message?: string;
  profile?: {
    supplier: { id:number; companyName:string; contactPerson:string; phone:string; email:string; address:string; notes:string; status:"active"|"inactive" };
    suppliedItems: Array<{ id:number; name:string; category:string; quantity:number; minimum_stock:number; unit:string; sku:string|null; unit_cost:number|string; status:string }>;
    recentDeliveries: Array<{ id:number; status:string; reference:string|null; received_at:string|null; created_at:string }>;
    restockHistory: Array<{ id:number; status:string; reference:string|null; notes:string; created_at:string; updated_at:string }>;
  };
};

type Restock = { id:number; status:string; reference:string|null; created_at:string; items:Array<{ id:number; itemName:string; requestedQuantity:number; deliveredQuantity:number|null }> };

const supplierTransitions: Record<string, string | undefined> = {
  Pending: "Accepted",
  Accepted: "Preparing",
  Preparing: "Shipped",
};

export function SupplierPortal({ user, onSignOut, onToast }: { user: ApiUser; onSignOut: () => void; onToast: (message:string) => void }) {
  const [profile, setProfile] = useState<SupplierProfileResponse["profile"]>();
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [savingPassword,setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileResponse, restockResponse] = await Promise.all([
        apiRequest("/api/supplier/me", { cache:"no-store" }),
        apiRequest("/api/restocks", { cache:"no-store" }),
      ]);
      const profileBody = await readApiBody<SupplierProfileResponse>(profileResponse);
      const restockBody = await readApiBody<{success:boolean;restocks?:Restock[];message?:string}>(restockResponse);
      if (!profileResponse.ok || !profileBody?.success || !profileBody.profile) throw new Error(profileBody?.message ?? "Unable to load supplier profile");
      if (!restockResponse.ok || !restockBody?.success) throw new Error(restockBody?.message ?? "Unable to load restock requests");
      setProfile(profileBody.profile);
      setRestocks(restockBody.restocks ?? []);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to load supplier portal");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { void load(); }, [load]);

  async function advance(restock: Restock) {
    const next = supplierTransitions[restock.status];
    if (!next) return;
    const response = await apiRequest(`/api/restocks/${restock.id}/status`, { method:"PATCH", body:JSON.stringify({status:next}) });
    const body = await readApiBody<{success:boolean;message?:string}>(response);
    if (!response.ok || !body?.success) {
      onToast(body?.message ?? "Unable to update restock");
      return;
    }
    onToast(`Restock marked ${next}`);
    await load();
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      onToast("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await apiRequest("/api/supplier/account", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await readApiBody<{success:boolean;message?:string}>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onToast("Password updated");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  const pending = restocks.filter((r) => !["Received","Cancelled"].includes(r.status));
  return <main className="customer-dashboard supplier-portal">
    <header className="customer-topbar"><div><p className="eyebrow">Supplier Portal</p><h1>{profile?.supplier.companyName ?? "Barracks supplier"}</h1><p>Signed in as {user.firstName} {user.lastName}</p></div><div className="supplier-portal__actions"><ThemeToggle /><Button variant="secondary" onClick={onSignOut}>Sign out</Button></div></header>
    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Supplied items" value={String(profile?.suppliedItems.length ?? 0)} icon="box" accent="blue" />
      <MetricCard label="Pending requests" value={String(pending.length)} icon="info" accent="amber" />
      <MetricCard label="Deliveries" value={String(profile?.recentDeliveries.length ?? 0)} icon="check" accent="green" />
      <MetricCard label="Account" value={profile?.supplier.status === "active" ? "Active" : "Inactive"} icon="users" accent="violet" />
    </div>
    <Panel><SectionHeading title="My profile" />{loading ? <p>Loading…</p> : profile ? <div className="detail-grid"><div><strong>Contact</strong><p>{profile.supplier.contactPerson || "Not set"}</p></div><div><strong>Email</strong><p>{profile.supplier.email || "Not set"}</p></div><div><strong>Phone</strong><p>{profile.supplier.phone || "Not set"}</p></div><div><strong>Address</strong><p>{profile.supplier.address || "Not set"}</p></div><div><strong>Notes</strong><p>{profile.supplier.notes || "No notes"}</p></div><div><strong>Login email</strong><p>{user.email}</p></div></div> : <EmptyState icon="users" title="No supplier profile" description="Ask an administrator to link this account to a supplier profile." />}</Panel>
    <Panel><SectionHeading title="Supplied items" />{profile?.suppliedItems.length ? <div className="staff-table">{profile.suppliedItems.map((item) => <div className="staff-table__row" key={item.id}><span><strong>{item.name}</strong><small>{item.category} · {item.sku ?? "No SKU"}</small></span><span>{item.quantity} {item.unit}</span><span><Badge tone={item.quantity <= item.minimum_stock ? "warning" : "success"}>{item.quantity <= item.minimum_stock ? "Low stock" : "In stock"}</Badge></span></div>)}</div> : <p>No linked items yet.</p>}</Panel>
    <Panel><SectionHeading title="Restock requests" />{restocks.length ? <div className="staff-table">{restocks.map((restock) => <div className="staff-table__row" key={restock.id}><span><strong>Request #{restock.id}</strong><small>{restock.reference ?? "No reference"}</small></span><span><Badge tone={restock.status === "Cancelled" ? "danger" : restock.status === "Received" ? "success" : "warning"}>{restock.status}</Badge></span><span>{supplierTransitions[restock.status] && <Button size="sm" onClick={() => void advance(restock)}>Mark {supplierTransitions[restock.status]}</Button>}</span></div>)}</div> : <p>No restock requests yet.</p>}</Panel>
    <Panel><SectionHeading title="Delivery history" />{profile?.recentDeliveries.length ? <div className="staff-table">{profile.recentDeliveries.map((delivery) => <div className="staff-table__row" key={delivery.id}><span><strong>Request #{delivery.id}</strong><small>{delivery.reference ?? "No reference"}</small></span><span>{delivery.received_at ? new Date(delivery.received_at).toLocaleString() : "Received"}</span><span><Badge tone="success">Received</Badge></span></div>)}</div> : <p>No received deliveries yet.</p>}</Panel>
    <Panel><SectionHeading title="Account settings" /><form className="modal-form" onSubmit={changePassword}><TextField required type="password" label="Current password" value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)} /><div className="form-grid"><TextField required type="password" label="New password" value={newPassword} onChange={(event)=>setNewPassword(event.target.value)} /><TextField required type="password" label="Confirm new password" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} /></div><div><Button type="submit" disabled={savingPassword}>{savingPassword?"Updating…":"Change password"}</Button></div></form></Panel>
  </main>;
}
