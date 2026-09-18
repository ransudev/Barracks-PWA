"use client";

import { useEffect, useState, type ReactNode } from "react";
import { adminNavigation, managerNavigation, staffNavigation } from "@/app/constants/navigation";
import { roleLabel as sharedRoleLabel } from "@/app/constants/roles";
import {
  Avatar,
  IconButton,
  Logo,
} from "@/app/components/ui";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";
import { Icon } from "@/app/components/ui/icons";
import { apiRequest, readApiBody, type ApiLowStockAlert, type ApiUser } from "@/app/lib/api";
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
  return sharedRoleLabel(user.role);
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
  mobileOpen,
  onMobileClose,
}: Omit<AppShellProps, "children"> & {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const isManagement = area === "admin";
  const canSwitchWorkspace = currentUser.role === "administrator";
  const navigation = isManagement
    ? currentUser.role === "administrator" ? adminNavigation : managerNavigation
    : staffNavigation;
  const homeView = dashboardForArea(area);
  const navigate = (view: ViewId) => {
    onMobileClose();
    go(view);
  };

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
    >
      <div className="sidebar__brand">
        <Logo onClick={() => navigate(homeView)} />
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
                  navigate("admin-dashboard");
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
                  navigate("staff-dashboard");
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
            onClick={() => navigate(item.id)}
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
            onMobileClose();
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
  mobileNavOpen,
  onToggleMobileNav,
}: Omit<AppShellProps, "children" | "active"> & {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lowStock, setLowStock] = useState<ApiLowStockAlert[]>([]);
  const [acknowledging, setAcknowledging] = useState(false);
  const isManagement = area === "admin";
  const canSwitchWorkspace = currentUser.role === "administrator";
  const name = displayName(currentUser);
  const initials = createInitials(name);
  const role = roleLabel(currentUser);
  const homeView = dashboardForArea(area);
  const visibleLowStock = lowStock;

  async function refreshLowStock() {
    try {
      const response = await apiRequest("/api/inventory/alerts", { cache: "no-store" });
      const body = await readApiBody<{ success:boolean; alerts?:ApiLowStockAlert[] }>(response);
      if (!response.ok || !body?.success) return;
      setLowStock(body.alerts ?? []);
    } catch {
      // Notifications should not block the rest of the workspace.
    }
  }

  useEffect(() => {
    // The request updates notification state after the external API resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLowStock();
    // A signed-in staff/admin account is required to render AppShell.
  }, [currentUser.id]);

  return (
    <header className="topbar">
      <div className="topbar__mobile-start">
        <IconButton
          className="topbar__mobile-menu"
          label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          icon={mobileNavOpen ? "x" : "menu"}
          active={mobileNavOpen}
          onClick={onToggleMobileNav}
        />
        <div className="topbar__mobile-logo">
          <Logo compact onClick={() => go(homeView)} />
        </div>
      </div>
      <div className="topbar__context">
        <span>{isManagement ? "Management" : "Shop floor"}</span>
        <Icon name="chevronRight" size={13} />
        <strong>
          {isManagement ? "Business overview" : "Operations"}
        </strong>
      </div>

      <div className="topbar__actions">
        <ThemeToggle compact />

        <div className="topbar__popover-wrap">
          <IconButton
            label={`View notifications${visibleLowStock.length ? ` (${visibleLowStock.length})` : ""}`}
            icon="bell"
            active={notificationsOpen}
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setProfileOpen(false);
              if (!notificationsOpen) void refreshLowStock();
            }}
          />
        {notificationsOpen && (
          <div className="popover notification-popover">
            <div className="popover__header">
              <strong>Notifications</strong>
            </div>
            {visibleLowStock.length ? visibleLowStock.map((item) => (
              <div className="notification-item" key={item.id}>
                <span><strong>{item.currentQuantity === 0 ? "Out of stock" : "Low stock"}: {item.itemName}</strong><small>{item.branch} · {item.currentQuantity} {item.unit} remaining · threshold {item.threshold}</small></span>
              </div>
            )) : (
              <div className="notification-item">
                <span>No active stock alerts.</span>
              </div>
            )}
              {visibleLowStock.length > 0 && <button
                className="popover__footer"
                type="button"
                disabled={acknowledging}
                onClick={() => {
                  setAcknowledging(true);
                  void Promise.all(visibleLowStock.map(async (item) => {
                    const response = await apiRequest(`/api/inventory/alerts/${item.itemId}/acknowledge`, { method: "POST" });
                    if (!response.ok) throw new Error("Unable to acknowledge stock alerts");
                  })).then(() => {
                    setLowStock([]);
                    setNotificationsOpen(false);
                    onToast("Low stock alerts acknowledged");
                  }).catch((error: unknown) => {
                    onToast(error instanceof Error ? error.message : "Unable to acknowledge stock alerts");
                    void refreshLowStock();
                  }).finally(() => setAcknowledging(false));
                }}
              >
                {acknowledging ? "Acknowledging…" : "Acknowledge stock alerts"}
              </button>}
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <button
        className={`mobile-nav-backdrop ${mobileNavOpen ? "is-open" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />
      <div className="app-main">
        <Topbar
          area={area}
          go={go}
          onToast={onToast}
          currentUser={currentUser}
          onSignOut={onSignOut}
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((value) => !value)}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
