"use client";

import { useState, type ReactNode } from "react";
import { adminNavigation, staffNavigation } from "@/app/constants/navigation";
import {
  Avatar,
  IconButton,
  Logo,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import type { ApiUser } from "@/app/lib/api";
import type { ShellArea, ViewId } from "@/app/types/domain";
import { createInitials } from "@/app/utils/format";

type AppShellProps = {
  area: ShellArea;
  active: ViewId;
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
  currentUser: ApiUser;
  onSignOut: () => void;
  children: ReactNode;
};

function displayName(user: ApiUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || "Account";
}

function roleLabel(user: ApiUser): string {
  if (user.role === "front_desk") return "Front Desk";
  if (user.role === "customer") return "Customer";
  return "Administrator";
}

function dashboardForArea(area: ShellArea): ViewId {
  return area === "admin" ? "admin-dashboard" : "staff-dashboard";
}

function Sidebar({
  area,
  active,
  go,
  onToast,
  currentUser,
  onSignOut,
  collapsed,
  onToggle,
}: Omit<AppShellProps, "children"> & {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isManagement = area === "admin";
  const canSwitchWorkspace = currentUser.role === "administrator";
  const navigation = isManagement ? adminNavigation : staffNavigation;
  const homeView = dashboardForArea(area);

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className="sidebar__brand">
        <Logo onClick={() => go(homeView)} />
        <IconButton
          className="sidebar__toggle"
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={collapsed ? "chevronRight" : "chevronLeft"}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          onClick={onToggle}
        />
      </div>

      {canSwitchWorkspace && (
        <div className="sidebar__workspace">
          <span className="sidebar__label">Workspace</span>
          <div className="workspace-switcher" role="group" aria-label="Choose workspace">
            <button
              className={`workspace-option ${isManagement ? "is-active" : ""}`}
              type="button"
              aria-pressed={isManagement}
              title="Management · Business view"
              onClick={() => {
                if (!isManagement) {
                  go("admin-dashboard");
                  onToast("Switched to management");
                }
              }}
            >
              <span className="workspace-option__mark">
                <Icon name="chart" size={15} />
              </span>
              <span className="workspace-option__label">Management</span>
            </button>
            <button
              className={`workspace-option ${!isManagement ? "is-active" : ""}`}
              type="button"
              aria-pressed={!isManagement}
              title="Shop floor · Live operations"
              onClick={() => {
                if (isManagement) {
                  go("staff-dashboard");
                  onToast("Switched to shop floor");
                }
              }}
            >
              <span className="workspace-option__mark">
                <Icon name="scissors" size={15} />
              </span>
              <span className="workspace-option__label">Shop floor</span>
            </button>
          </div>
        </div>
      )}

      <nav
        className="sidebar__nav"
        aria-label={`${isManagement ? "Management" : "Staff"} navigation`}
      >
        <span className="sidebar__label">Navigate</span>
        {navigation.map((item) => (
          <button
            className={`sidebar__link ${active === item.id ? "is-active" : ""}`}
            type="button"
            aria-label={item.label}
            title={item.label}
            key={item.id}
            onClick={() => go(item.id)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}

      </nav>

      <div className="sidebar__footer">
        <button
          className="sidebar__signout"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => {
            void onSignOut();
          }}
        >
          <Icon name="logOut" size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  area,
  go,
  onToast,
  currentUser,
  onSignOut,
}: Omit<AppShellProps, "children" | "active">) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isManagement = area === "admin";
  const canSwitchWorkspace = currentUser.role === "administrator";
  const name = displayName(currentUser);
  const initials = createInitials(name);
  const role = roleLabel(currentUser);
  const homeView = dashboardForArea(area);

  return (
    <header className="topbar">
      <div className="topbar__mobile-logo">
        <Logo compact onClick={() => go(homeView)} />
      </div>
      <div className="topbar__context">
        <span>{isManagement ? "Management" : "Shop floor"}</span>
        <Icon name="chevronRight" size={13} />
        <strong>
          {isManagement ? "Business overview" : "Operations"}
        </strong>
      </div>

      <div className="topbar__actions">
        <div className="topbar__popover-wrap">
          <IconButton
            label="View notifications"
            icon="bell"
            active={notificationsOpen}
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileOpen(false);
            }}
          />
        {notificationsOpen && (
          <div className="popover notification-popover">
            <div className="popover__header">
              <strong>Notifications</strong>
            </div>
            <div className="notification-item">
              <span>No notifications yet.</span>
            </div>
              <button
                className="popover__footer"
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  onToast("All notifications marked as read");
                }}
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>

        <div className="topbar__popover-wrap">
          <button
            className="topbar__account"
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationsOpen(false);
            }}
          >
            <Avatar
              initials={initials}
              tone={isManagement ? "violet" : "blue"}
              size="sm"
            />
            <span>
              <strong>{name}</strong>
              <small>{role}</small>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>
          {profileOpen && (
            <div className="popover profile-popover">
              <div className="profile-popover__identity">
                <Avatar
                  initials={initials}
                  tone={isManagement ? "violet" : "blue"}
                  size="md"
                />
                <span>
                  <strong>{name}</strong>
                  <small>{role}</small>
                </span>
              </div>
              {canSwitchWorkspace && (
                <button
                  type="button"
                  onClick={() => go(isManagement ? "staff-dashboard" : "admin-dashboard")}
                >
                  <Icon name="refresh" size={15} />
                  Switch workspace
                </button>
              )}
              <button
                className="is-danger"
                type="button"
                onClick={() => {
                  void onSignOut();
                }}
              >
                <Icon name="logOut" size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  area,
  active,
  go,
  onToast,
  currentUser,
  onSignOut,
  children,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}
    >
      <Sidebar
        area={area}
        active={active}
        go={go}
        onToast={onToast}
        currentUser={currentUser}
        onSignOut={onSignOut}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="app-main">
        <Topbar
          area={area}
          go={go}
          onToast={onToast}
          currentUser={currentUser}
          onSignOut={onSignOut}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
