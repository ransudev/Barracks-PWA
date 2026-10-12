"use client";

import type { ApiUser } from "@/app/lib/api";
import type { ViewId } from "@/app/types/domain";
import { PortalTopbar } from "@/app/components/layout/PortalTopbar";

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
    <PortalTopbar
      onHome={() => go("landing")}
      links={[
        { id: "customer-dashboard", label: "Dashboard" },
        { id: "customer-booking", label: "Book" },
      ]}
      active={active === "customer-profile" ? "customer-dashboard" : active}
      onNavigate={(id) => go(id as ViewId)}
      name={user ? `${user.firstName} ${user.lastName}`.trim() || "Customer" : "Customer"}
      role="Customer"
      onSignOut={onSignOut}
    />
  );
}
