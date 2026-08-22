"use client";

import { useState, type ReactNode } from "react";
import { adminNavigation, staffNavigation } from "@/app/constants/navigation";
import {
  Avatar,
  Badge,
  IconButton,
  Logo,
  SearchInput,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import type { ShellArea, ViewId } from "@/app/types/domain";

type AppShellProps = {
  area: ShellArea;
  active: ViewId;
  go: (view: ViewId) => void;
  search: string;
  setSearch: (value: string) => void;
  onToast: (message: string) => void;
  children: ReactNode;
};

function Sidebar({
  area,
  active,
  go,
  onToast,
  collapsed,
  onToggle,
}: Omit<AppShellProps, "children" | "search" | "setSearch"> & {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isAdmin = area === "admin";
  const navigation = isAdmin ? adminNavigation : staffNavigation;
  const settingsView = isAdmin ? "admin-settings" : "staff-settings";

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className="sidebar__brand">
        <Logo onClick={() => go("landing")} />
        <IconButton
          className="sidebar__toggle"
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          icon={collapsed ? "chevronRight" : "chevronLeft"}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          onClick={onToggle}
        />
      </div>

      <div className="sidebar__workspace">
        <span className="sidebar__label">Workspace</span>
        <button
          className="workspace-switcher"
          type="button"
          aria-label={`Switch to ${isAdmin ? "shop floor" : "management"}`}
          title={`Switch to ${isAdmin ? "shop floor" : "management"}`}
          onClick={() => {
            go(isAdmin ? "staff-dashboard" : "admin-dashboard");
            onToast(`Switched to ${isAdmin ? "shop floor" : "management"}`);
          }}
        >
          <span
            className={`workspace-switcher__mark ${isAdmin ? "is-admin" : ""}`}
          >
            <Icon name={isAdmin ? "chart" : "scissors"} size={15} />
          </span>
          <span>
            <strong>{isAdmin ? "Management" : "Shop floor"}</strong>
            <small>{isAdmin ? "Business view" : "Live operations"}</small>
          </span>
          <Icon name="chevronDown" size={15} />
        </button>
      </div>

      <nav
        className="sidebar__nav"
        aria-label={`${isAdmin ? "Management" : "Staff"} navigation`}
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
            {item.id === "queue" && <span className="sidebar__count">5</span>}
          </button>
        ))}

        <span className="sidebar__label sidebar__label--spaced">System</span>
        <button
          className={`sidebar__link ${active === settingsView ? "is-active" : ""}`}
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={() => go(settingsView)}
        >
          <Icon name="settings" size={18} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar__footer">
        <button
          className="sidebar__signout"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => {
            go("landing");
            onToast("Signed out");
          }}
        >
          <Icon name="logOut" size={17} />
          <span>Sign out</span>
        </button>
        <button
          className="sidebar__profile"
          type="button"
          aria-label="Open account settings"
          title="Open account settings"
          onClick={() => go(settingsView)}
        >
          <Avatar
            initials={isAdmin ? "AD" : "JM"}
            tone={isAdmin ? "violet" : "blue"}
            size="sm"
          />
          <span>
            <strong>{isAdmin ? "Avery Dela Cruz" : "Jules Mendoza"}</strong>
            <small>{isAdmin ? "Administrator" : "Front desk"}</small>
          </span>
          <Icon name="more" size={17} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  area,
  go,
  search,
  setSearch,
  onToast,
}: Omit<AppShellProps, "children" | "active">) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isAdmin = area === "admin";

  return (
    <header className="topbar">
      <div className="topbar__mobile-logo">
        <Logo compact onClick={() => go("landing")} />
      </div>
      <div className="topbar__context">
        <span>{isAdmin ? "Management" : "Shop floor"}</span>
        <Icon name="chevronRight" size={13} />
        <strong>
          {isAdmin ? "Business overview" : "Tuesday, April 14, 2026"}
        </strong>
      </div>

      <div className="topbar__actions">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search the workspace"
          className="topbar__search"
        />

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
          <span className="notification-dot" />
          {notificationsOpen && (
            <div className="popover notification-popover">
              <div className="popover__header">
                <strong>Notifications</strong>
                <Badge tone="info">3 new</Badge>
              </div>
              <div className="notification-item">
                <span className="notification-item__icon notification-item__icon--red">
                  <Icon name="box" size={15} />
                </span>
                <span>
                  <strong>Low stock alert</strong>
                  <small>Hair Clippers Oil is below minimum.</small>
                </span>
              </div>
              <div className="notification-item">
                <span className="notification-item__icon notification-item__icon--blue">
                  <Icon name="calendar" size={15} />
                </span>
                <span>
                  <strong>Next booking in 18 min</strong>
                  <small>Emma Wilson · Haircut</small>
                </span>
              </div>
              <div className="notification-item">
                <span className="notification-item__icon notification-item__icon--green">
                  <Icon name="checkCircle" size={15} />
                </span>
                <span>
                  <strong>Daily close is ready</strong>
                  <small>Yesterday’s numbers were reconciled.</small>
                </span>
              </div>
              <button
                className="popover__footer"
                type="button"
                onClick={() => {
                  setNotificationsOpen(false);
                  onToast("All notifications marked as read");
                }}
              >
                Mark all as read <Icon name="arrowRight" size={14} />
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
              initials={isAdmin ? "AD" : "JM"}
              tone={isAdmin ? "violet" : "blue"}
              size="sm"
            />
            <span>
              <strong>{isAdmin ? "Avery" : "Jules"}</strong>
              <small>{isAdmin ? "Admin" : "Staff"}</small>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>
          {profileOpen && (
            <div className="popover profile-popover">
              <div className="profile-popover__identity">
                <Avatar
                  initials={isAdmin ? "AD" : "JM"}
                  tone={isAdmin ? "violet" : "blue"}
                  size="md"
                />
                <span>
                  <strong>
                    {isAdmin ? "Avery Dela Cruz" : "Jules Mendoza"}
                  </strong>
                  <small>{isAdmin ? "Administrator" : "Front desk"}</small>
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  go(isAdmin ? "admin-settings" : "staff-settings")
                }
              >
                <Icon name="settings" size={15} />
                Account settings
              </button>
              <button
                type="button"
                onClick={() =>
                  go(isAdmin ? "staff-dashboard" : "admin-dashboard")
                }
              >
                <Icon name="refresh" size={15} />
                Switch workspace
              </button>
              <button
                className="is-danger"
                type="button"
                onClick={() => {
                  go("landing");
                  onToast("Signed out");
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
  search,
  setSearch,
  onToast,
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
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="app-main">
        <Topbar
          area={area}
          go={go}
          search={search}
          setSearch={setSearch}
          onToast={onToast}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
