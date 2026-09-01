"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest, readApiBody, type ApiRole, type ApiUser } from "@/app/lib/api";
import { roleOptions } from "@/app/constants/roles";
import { createInitials } from "@/app/utils/format";
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

type AccountStatus = "active" | "pending" | "blocked";
type LifecycleAction = "verify" | "unverify" | "block" | "unblock";

type UsersResponse = {
  success: boolean;
  users?: ApiUser[];
  message?: string;
};

type UserResponse = {
  success: boolean;
  user?: ApiUser;
  message?: string;
  errors?: Record<string, string[]>;
};

type AccountForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: ApiRole;
};

const emptyForm: AccountForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "front_desk",
};

function responseMessage(
  body: { message?: string; errors?: Record<string, string[]> } | null,
  fallback: string,
): string {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return validationMessage || body?.message || fallback;
}

function displayName(user: ApiUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function roleLabel(role: ApiRole): string {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function accountStatus(user: ApiUser): AccountStatus {
  if (user.isBlocked) return "blocked";
  if (!user.isVerified) return "pending";
  return "active";
}

function accountStatusLabel(status: AccountStatus): string {
  return status === "active" ? "Active" : status === "pending" ? "Pending verification" : "Blocked";
}

function accountStatusTone(status: AccountStatus): "success" | "warning" | "danger" {
  return status === "active" ? "success" : status === "pending" ? "warning" : "danger";
}

function formatJoined(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function replaceUser(list: ApiUser[], next: ApiUser): ApiUser[] {
  return list.map((user) => (user.id === next.id ? next : user));
}

export function StaffManagement({ onToast }: { onToast: (message: string) => void }) {
  const [items, setItems] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | ApiRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingLifecycle, setPendingLifecycle] = useState<{ user: ApiUser; action: LifecycleAction } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiUser | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/users", { cache: "no-store" });
      const body = await readApiBody<UsersResponse>(response);
      if (!response.ok || !body?.success || !body.users) {
        throw new Error(body?.message ?? "Unable to load user accounts");
      }
      setItems(body.users);
      setLoadError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load user accounts";
      setLoadError(message);
      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadUsers());
    return () => window.cancelAnimationFrame(frame);
  }, [loadUsers]);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = items.filter((user) => {
    const status = accountStatus(user);
    const matchesSearch = !normalizedSearch || `${displayName(user)} ${user.email} ${roleLabel(user.role)}`.toLowerCase().includes(normalizedSearch);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(user: ApiUser) {
    setEditing(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormError("");
    setDetailsOpen(false);
    setModalOpen(true);
  }

  function closeEditor() {
    if (submitting) return;
    setModalOpen(false);
    setFormError("");
  }

  function viewDetails(user: ApiUser) {
    setSelected(user);
    setDetailsOpen(true);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      };
      const response = await apiRequest(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<UserResponse>(response);
      if (!response.ok || !body?.success || !body.user) {
        throw new Error(responseMessage(body, "Unable to save user account"));
      }

      const saved = body.user;
      setItems((current) => editing ? replaceUser(current, saved) : [saved, ...current]);
      setModalOpen(false);
      setForm(emptyForm);
      if (editing) {
        setSelected(saved);
        setDetailsOpen(true);
      }
      onToast(`${displayName(saved)} ${editing ? "updated" : "created"}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save user account");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeLifecycle(user: ApiUser, action: LifecycleAction) {
    setLifecycleBusy(true);
    try {
      const response = await apiRequest(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      const body = await readApiBody<UserResponse>(response);
      if (!response.ok || !body?.success || !body.user) {
        throw new Error(responseMessage(body, "Unable to update account status"));
      }
      setItems((current) => replaceUser(current, body.user!));
      setSelected(body.user);
      onToast(`${displayName(body.user)} is now ${accountStatusLabel(accountStatus(body.user)).toLowerCase()}`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to update account status");
    } finally {
      setLifecycleBusy(false);
      setPendingLifecycle(null);
    }
  }

  async function deleteUser(user: ApiUser) {
    setDeleteBusy(true);
    try {
      const response = await apiRequest(`/api/users/${user.id}`, { method: "DELETE" });
      const body = await readApiBody<UserResponse>(response);
      if (!response.ok || !body?.success) {
        throw new Error(responseMessage(body, "Unable to deactivate user account"));
      }
      setItems((current) => current.filter((currentUser) => currentUser.id !== user.id));
      if (selected?.id === user.id) {
        setSelected(null);
        setDetailsOpen(false);
      }
      onToast(`${displayName(user)} deactivated; the record was retained`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to deactivate user account");
    } finally {
      setDeleteBusy(false);
      setPendingDelete(null);
    }
  }

  function requestLifecycle(user: ApiUser, action: LifecycleAction) {
    if (action === "block" || action === "unverify") {
      setPendingLifecycle({ user, action });
      return;
    }
    void changeLifecycle(user, action);
  }

  const activeCount = items.filter((user) => accountStatus(user) === "active").length;
  const pendingCount = items.filter((user) => accountStatus(user) === "pending").length;
  const blockedCount = items.filter((user) => accountStatus(user) === "blocked").length;

  return (
    <>
      <PageHeader
        title="User management"
        action={<Button icon="userPlus" onClick={openCreate}>Create account</Button>}
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard label="Total accounts" value={String(items.length)} icon="users" accent="blue" />
        <MetricCard label="Active & verified" value={String(activeCount)} icon="checkCircle" accent="green" />
        <MetricCard label="Pending verification" value={String(pendingCount)} icon="clock" accent="amber" />
        <MetricCard label="Blocked" value={String(blockedCount)} icon="lock" accent="red" />
      </div>

      <Panel className="staff-table-panel">
        <SectionHeading
          title="Staff accounts"
          action={
            <div className="panel-toolbar panel-toolbar--filters">
              <SearchInput value={search} onChange={setSearch} placeholder="Search accounts" />
              <SelectField value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | ApiRole)} aria-label="Filter accounts by role">
                <option value="all">All roles</option>
                {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </SelectField>
              <SelectField value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AccountStatus)} aria-label="Filter accounts by status">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending verification</option>
                <option value="blocked">Blocked</option>
              </SelectField>
            </div>
          }
        />
        <div className="staff-table">
          <div className="staff-table__head">
            <span>Name</span><span>Role</span><span>Email</span><span>Access</span><span>Joined</span><span>Actions</span>
          </div>
          {loading ? <div className="staff-table__empty" role="status">Loading user accounts…</div> : loadError ? <div className="staff-table__empty" role="alert">{loadError}</div> : filtered.length ? filtered.map((user) => {
            const status = accountStatus(user);
            return (
              <div className="staff-table__row" key={user.id}>
                <span className="table-person"><Avatar initials={createInitials(displayName(user))} tone={user.role === "administrator" ? "violet" : "blue"} size="sm" /><span><strong>{displayName(user)}</strong><small>{user.email}</small></span></span>
                <span><Badge tone={user.role === "administrator" ? "purple" : "neutral"}>{roleLabel(user.role)}</Badge></span>
                <span>{user.email}</span>
                <span className="account-status-cell"><Badge tone={accountStatusTone(status)}>{accountStatusLabel(status)}</Badge><small>{user.isVerified ? "Verified" : "Unverified"} · {user.isBlocked ? "Blocked" : "Unblocked"}</small></span>
                <span>{formatJoined(user.createdAt)}</span>
                <span className="row-actions">
                  <button className="row-action row-action--icon" type="button" onClick={() => viewDetails(user)} aria-label={`View details for ${displayName(user)}`} title={`View details for ${displayName(user)}`}><Icon name="external" size={16} /></button>
                  <button className="row-action row-action--icon" type="button" onClick={() => openEdit(user)} aria-label={`Edit ${displayName(user)}`} title={`Edit ${displayName(user)}`}><Icon name="edit" size={16} /></button>
                  <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => setPendingDelete(user)} aria-label={`Deactivate ${displayName(user)}`} title={`Deactivate ${displayName(user)}`}><Icon name="trash" size={16} /></button>
                </span>
              </div>
            );
          }) : <EmptyState icon="users" title="No accounts found" description="Try another search or filter, or create a new staff account." action={<Button size="sm" icon="userPlus" onClick={openCreate}>Create account</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit user account" : "Create user account"} onClose={closeEditor}>
        <form className="modal-form" onSubmit={saveUser}>
          <div className="form-grid form-grid--two">
            <TextField label="First name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="e.g. John" autoComplete="given-name" />
            <TextField label="Last name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="e.g. Doe" autoComplete="family-name" />
          </div>
          <TextField label="Email address" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@barracks.ph" icon="mail" type="email" autoComplete="email" />
          <TextField label={editing ? "New password (optional)" : "Password"} required={!editing} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" icon="lock" type="password" autoComplete={editing ? "new-password" : "new-password"} />
          <SelectField label="Role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ApiRole })}>
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          {!editing && <p className="form-hint">After creation, verify the account in its details view before the person can sign in.</p>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={submitting} onClick={closeEditor}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Create account"}</Button></div>
        </form>
      </Modal>

      <Modal open={detailsOpen && Boolean(selected)} title={selected ? displayName(selected) : "Account details"} onClose={() => setDetailsOpen(false)}>
        {selected && (
          <div className="detail-modal account-detail-modal">
            <div className="detail-modal__identity"><Avatar initials={createInitials(displayName(selected))} tone={selected.role === "administrator" ? "violet" : "blue"} size="lg" /><div><strong>{displayName(selected)}</strong><span>{selected.email}</span></div></div>
            <div className="detail-modal__rows">
              <div className="detail-modal__row"><span>Role</span><strong>{roleLabel(selected.role)}</strong></div>
              <div className="detail-modal__row"><span>Account status</span><Badge tone={accountStatusTone(accountStatus(selected))}>{accountStatusLabel(accountStatus(selected))}</Badge></div>
              <div className="detail-modal__row"><span>Verification</span><strong>{selected.isVerified ? "Verified" : "Unverified"}</strong></div>
              <div className="detail-modal__row"><span>Blocked</span><strong>{selected.isBlocked ? "Blocked" : "Unblocked"}</strong></div>
              <div className="detail-modal__row"><span>Joined</span><strong>{new Date(selected.createdAt).toLocaleString()}</strong></div>
              <div className="detail-modal__row"><span>Last updated</span><strong>{new Date(selected.updatedAt).toLocaleString()}</strong></div>
            </div>
            <p className="modal-copy">Changing an account to blocked or unverified immediately revokes its active sessions.</p>
            <div className="modal-actions account-detail-actions">
              <Button variant="secondary" icon="edit" onClick={() => openEdit(selected)}>Edit account</Button>
              {selected.isVerified ? <Button variant="secondary" onClick={() => requestLifecycle(selected, "unverify")}>Unverify</Button> : <Button variant="success" onClick={() => requestLifecycle(selected, "verify")}>Verify account</Button>}
              {selected.isBlocked ? <Button variant="success" onClick={() => requestLifecycle(selected, "unblock")}>Unblock</Button> : <Button variant="danger" onClick={() => requestLifecycle(selected, "block")}>Block account</Button>}
              <Button variant="danger" icon="trash" onClick={() => setPendingDelete(selected)}>Deactivate</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingLifecycle)}
        title={pendingLifecycle?.action === "block" ? "Block this account?" : "Unverify this account?"}
        description={pendingLifecycle ? `${displayName(pendingLifecycle.user)} will be unable to sign in, and any active session will be revoked.` : undefined}
        confirmLabel={pendingLifecycle?.action === "block" ? "Block account" : "Unverify account"}
        danger
        busy={lifecycleBusy}
        onClose={() => !lifecycleBusy && setPendingLifecycle(null)}
        onConfirm={() => pendingLifecycle && void changeLifecycle(pendingLifecycle.user, pendingLifecycle.action)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Deactivate this account?"
        description={pendingDelete ? `${displayName(pendingDelete)} will be signed out and removed from active account lists. The database record is retained for auditability.` : undefined}
        confirmLabel="Deactivate account"
        danger
        busy={deleteBusy}
        onClose={() => !deleteBusy && setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deleteUser(pendingDelete)}
      />
    </>
  );
}
