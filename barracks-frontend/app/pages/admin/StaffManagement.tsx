"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest, readApiBody, type ApiRole, type ApiUser } from "@/app/lib/api";
import type { StaffMember } from "@/app/types/domain";
import { createInitials } from "@/app/utils/format";
import {
  Avatar,
  Badge,
  Button,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";

type UsersResponse = {
  success: boolean;
  users?: ApiUser[];
  message?: string;
};

type CreateUserResponse = {
  success: boolean;
  user?: ApiUser;
  message?: string;
};

const roleLabels: Record<ApiRole, StaffMember["role"]> = {
  administrator: "Administrator",
  barber: "Barber",
  front_desk: "Front Desk",
};

function toStaffMember(user: ApiUser): StaffMember {
  const name = user.username.trim();
  const joined = user.lastLogin
    ? new Date(user.lastLogin).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : "Never";

  return {
    id: String(user.userID),
    name,
    initials: createInitials(name),
    role: roleLabels[user.role],
    email: user.username,
    phone: "—",
    status: user.active ? "Active" : "Disabled",
    joined,
    tone: user.role === "administrator" ? "violet" : user.role === "barber" ? "green" : "blue",
  };
}

function roleTone(role: StaffMember["role"]): "neutral" | "info" | "purple" {
  if (role === "Administrator") return "purple";
  if (role === "Barber") return "info";
  return "neutral";
}

export function StaffManagement({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [items, setItems] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "front_desk" as ApiRole,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        const response = await apiRequest("/api/users");
        const body = await readApiBody<UsersResponse>(response);

        if (!response.ok || !body?.success || !body.users) {
          throw new Error(body?.message ?? "Unable to load user accounts");
        }

        if (!cancelled) {
          setItems(body.users.map(toStaffMember));
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load user accounts";
          setItems([]);
          setLoadError(message);
          onToast(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  const filtered = items.filter((item) =>
    (item.name + " " + item.email + " " + item.role)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function resetForm() {
    setNewUser({
      username: "",
      password: "",
      role: "front_desk",
    });
    setFormError("");
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const response = await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUser.username.trim(),
          password: newUser.password,
          role: newUser.role,
        }),
      });
      const body = await readApiBody<CreateUserResponse>(response);

      if (!response.ok || !body?.success || !body.user) {
        throw new Error(body?.message ?? "Unable to create user account");
      }

      const created = toStaffMember(body.user);
      setItems((list) => [created, ...list]);
      resetForm();
      setModalOpen(false);
      onToast(`${created.name} added to staff`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create user account";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="User management"
        action={
          <Button icon="userPlus" onClick={() => setModalOpen(true)}>
            Create account
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard
          label="Total accounts"
          value={String(items.length)}
          icon="users"
          accent="blue"
        />
        <MetricCard
          label="Barbers"
          value={String(items.filter((item) => item.role === "Barber").length)}
          icon="scissors"
          accent="green"
        />
        <MetricCard
          label="Administrators"
          value={String(items.filter((item) => item.role === "Administrator").length)}
          icon="lock"
          accent="violet"
        />
      </div>

      <Panel className="staff-table-panel">
        <SectionHeading
          title="All user accounts"
          action={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search accounts"
            />
          }
        />
        <div className="staff-table">
          <div className="staff-table__head">
            <span>Name</span>
            <span>Role</span>
            <span>Email</span>
            <span>Status</span>
            <span>Joined</span>
          </div>
          {loading ? (
            <div className="staff-table__empty">Loading user accounts…</div>
          ) : loadError ? (
            <div className="staff-table__empty">{loadError}</div>
          ) : filtered.length ? (
            filtered.map((item) => (
              <div className="staff-table__row" key={item.id}>
                <span className="table-person">
                  <Avatar initials={item.initials} tone={item.tone} size="sm" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.phone}</small>
                  </span>
                </span>
                <span>
                  <Badge tone={roleTone(item.role)}>{item.role}</Badge>
                </span>
                <span>{item.email}</span>
                <span>
                  <Badge tone="success">{item.status}</Badge>
                </span>
                <span>{item.joined}</span>
              </div>
            ))
          ) : (
            <div className="staff-table__empty">No user accounts match your search.</div>
          )}
        </div>
      </Panel>

      <Modal
        open={modalOpen}
        title="Create user account"
        description="Save a profile and assign the access role it should use."
        onClose={() => {
          if (!submitting) {
            setModalOpen(false);
            resetForm();
          }
        }}
      >
        <form className="modal-form" onSubmit={addUser}>
          <TextField
            label="Username"
            value={newUser.username}
            onChange={(event) =>
              setNewUser({ ...newUser, username: event.target.value })
            }
            placeholder="e.g. admin"
            icon="users"
            type="text"
          />
          <TextField
            label="Password"
            value={newUser.password}
            onChange={(event) =>
              setNewUser({ ...newUser, password: event.target.value })
            }
            placeholder="At least 8 characters"
            icon="lock"
            type="password"
          />
          <SelectField
            label="Role / category"
            value={newUser.role}
            onChange={(event) =>
              setNewUser({ ...newUser, role: event.target.value as ApiRole })
            }
          >
            <option value="front_desk">Front Desk</option>
            <option value="barber">Barber</option>
            <option value="administrator">Administrator</option>
          </SelectField>
          {formError && <p className="form-error">{formError}</p>}
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              disabled={submitting}
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" icon="userPlus" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
