"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ApiUser } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  MetricCard,
  Panel,
  SectionHeading,
  TextField,
} from "@/app/components/ui";
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

function restockTone(status: string): "danger" | "success" | "warning" {
  if (status === "Cancelled") return "danger";
  if (status === "Received") return "success";
  return "warning";
}

function formatDeliveryDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Received";
}

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

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

  const pending = restocks.filter((restock) => !["Received", "Cancelled"].includes(restock.status));
  const supplier = profile?.supplier;
  const supplierInitials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <main className="supplier-portal">
      <header className="supplier-portal__topbar">
        <div className="supplier-portal__topbar-inner">
          <div className="supplier-portal__brand">
            <Avatar initials={supplierInitials || "SP"} tone="green" size="md" />
            <div>
              <h1>{supplier?.companyName ?? "Barracks supplier"}</h1>
              <p>
                Supplier workspace · Signed in as {user.firstName} {user.lastName}
              </p>
            </div>
          </div>
          <div className="supplier-portal__actions">
            <ThemeToggle />
            <Button variant="secondary" onClick={onSignOut} icon="logOut">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="supplier-portal__content">
        <section className="supplier-portal__intro" aria-labelledby="supplier-page-title">
          <div>
            <h2 id="supplier-page-title">Supply desk</h2>
            <p>Review your linked inventory, move open requests forward, and keep your account secure.</p>
          </div>
        </section>

        <div className="supplier-portal__overview">
          <Panel className="supplier-profile-card">
          <SectionHeading
            title="Supplier profile"
            description="The business record linked to this supplier login."
          />
          {loading ? (
            <div className="supplier-portal__loading">Loading supplier details…</div>
          ) : profile ? (
            <>
              <div className="supplier-profile-card__identity">
                <Avatar initials={supplierInitials || "SP"} tone="green" size="lg" />
                <div>
                  <span className="supplier-profile-card__label">Business contact</span>
                  <h3>{profile.supplier.companyName}</h3>
                  <p>{profile.supplier.contactPerson || "No contact person set"}</p>
                </div>
                <Badge tone={profile.supplier.status === "active" ? "success" : "danger"}>
                  {profile.supplier.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="supplier-profile-card__facts">
                <div className="supplier-fact">
                  <span>Contact email</span>
                  <strong>{profile.supplier.email || "Not set"}</strong>
                </div>
                <div className="supplier-fact">
                  <span>Phone</span>
                  <strong>{profile.supplier.phone || "Not set"}</strong>
                </div>
                <div className="supplier-fact supplier-fact--wide">
                  <span>Address</span>
                  <strong>{profile.supplier.address || "Not set"}</strong>
                </div>
                <div className="supplier-fact supplier-fact--wide">
                  <span>Login email</span>
                  <strong>{user.email}</strong>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon="users"
              title="No supplier profile"
              description="Ask an administrator to link this account to a supplier profile."
            />
          )}
          </Panel>

          <div className="supplier-portal__metrics">
            <MetricCard label="Linked items" value={String(profile?.suppliedItems.length ?? 0)} icon="box" accent="blue" />
            <MetricCard label="Open requests" value={String(pending.length)} icon="info" accent="amber" />
            <MetricCard label="Received deliveries" value={String(profile?.recentDeliveries.length ?? 0)} icon="check" accent="green" />
            <MetricCard label="Account status" value={supplier?.status === "active" ? "Active" : "Inactive"} icon="users" accent="violet" />
          </div>
        </div>

        <div className="supplier-portal__workspace">
          <div className="supplier-portal__primary-column">
            <Panel className="supplier-items-panel">
              <SectionHeading
                title="Supplied items"
                description="Inventory currently linked to your account."
              />
              {profile?.suppliedItems.length ? (
                <div className="supplier-item-list" role="list">
                  {profile.suppliedItems.map((item) => {
                    const isLowStock = item.quantity <= item.minimum_stock;
                    return (
                      <div className="supplier-item-row" key={item.id} role="listitem">
                        <div className="supplier-item-row__product">
                          <strong>{item.name}</strong>
                          <span>{item.category} · {item.sku ?? "No SKU"}</span>
                        </div>
                        <div className="supplier-item-row__quantity">
                          <span>On hand</span>
                          <strong>{item.quantity} <small>{item.unit}</small></strong>
                        </div>
                        <div className="supplier-item-row__status">
                          <Badge tone={isLowStock ? "warning" : "success"}>
                            {isLowStock ? "Low stock" : "In stock"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="supplier-portal__empty-copy">No linked items yet.</p>
              )}
            </Panel>
          </div>

          <aside className="supplier-portal__secondary-column">
            <Panel className="supplier-requests-panel">
              <SectionHeading
                title="Restock requests"
                description="Requests waiting for your next update."
              />
              {restocks.length ? (
                <div className="supplier-request-list">
                  {restocks.map((restock) => {
                    const next = supplierTransitions[restock.status];
                    const items = restock.items.map((item) => `${item.itemName} × ${item.requestedQuantity}`).join(", ");
                    return (
                      <article className="supplier-request-row" key={restock.id}>
                        <div className="supplier-request-row__details">
                          <div>
                            <strong>Request #{restock.id}</strong>
                            <span>{restock.reference ?? "No reference"}</span>
                          </div>
                          <p>{items || "No line items"}</p>
                        </div>
                        <div className="supplier-request-row__actions">
                          <Badge tone={restockTone(restock.status)}>{restock.status}</Badge>
                          {next && (
                            <Button size="sm" onClick={() => void advance(restock)}>
                              Mark {next}
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="supplier-portal__empty-copy">No restock requests yet.</p>
              )}
            </Panel>

            <Panel className="supplier-deliveries-panel">
              <SectionHeading
                title="Delivery history"
                description="Recently received supplier deliveries."
              />
              {profile?.recentDeliveries.length ? (
                <div className="supplier-delivery-list">
                  {profile.recentDeliveries.map((delivery) => (
                    <article className="supplier-delivery-row" key={delivery.id}>
                      <div>
                        <strong>Request #{delivery.id}</strong>
                        <span>{delivery.reference ?? "No reference"}</span>
                      </div>
                      <div>
                        <span>{formatDeliveryDate(delivery.received_at)}</span>
                        <Badge tone="success">Received</Badge>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="supplier-portal__empty-copy">No received deliveries yet.</p>
              )}
            </Panel>
          </aside>
        </div>

        <Panel className="supplier-account-panel">
          <SectionHeading
            title="Account security"
            description="Update the password used for this supplier login."
          />
          <form className="supplier-password-form" onSubmit={changePassword}>
            <div className="supplier-password-form__fields">
              <TextField
                required
                type="password"
                label="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <TextField
                required
                type="password"
                label="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <TextField
                required
                type="password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <div className="supplier-password-form__footer">
              <p>Choose a password you do not reuse elsewhere.</p>
              <Button type="submit" disabled={savingPassword} icon="lock">
                {savingPassword ? "Updating…" : "Change password"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
