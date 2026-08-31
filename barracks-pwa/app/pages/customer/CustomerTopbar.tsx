"use client";

import type { ApiUser } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { Logo } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

export function CustomerTopbar({
  go,
  active,
  onSignOut,
  user,
}: {
  go: (view: ViewId) => void;
  active: ViewId;
  onSignOut: () => void;
  user?: ApiUser | null;
}) {
  return (
    <header className="customer-topbar">
      <Logo onClick={() => go("landing")} />
      <nav className="customer-topbar__links" aria-label="Customer navigation">
        <button
          type="button"
          className={active === "customer-dashboard" || active === "customer-profile" ? "is-active" : ""}
          onClick={() => go("customer-dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={active === "customer-booking" ? "is-active" : ""}
          onClick={() => go("customer-booking")}
        >
          Book
        </button>
        <span>{user ? `${user.firstName} ${user.lastName}` : "Customer account"}</span>
        <button type="button" onClick={onSignOut}>
          Sign out <Icon name="logOut" size={14} />
        </button>
      </nav>
    </header>
  );
}
