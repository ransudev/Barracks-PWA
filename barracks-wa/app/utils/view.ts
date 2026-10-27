import { viewAccessGroups } from "@/app/constants/navigation";
import { isManagementRole, isStaffRole } from "@/app/constants/roles";
import type { ShellArea, ViewId } from "@/app/types/domain";

// Management roles always use the full management sidebar; front desk uses its own.
export function workspaceAreaForView(_view: ViewId, role: string): ShellArea {
  return isManagementRole(role) ? "admin" : "staff";
}

export function requiresManagement(view: ViewId) {
  return ["management", "administrator"].includes(viewAccessGroups[view]);
}

export function isProtectedView(view: ViewId): boolean {
  return viewAccessGroups[view] !== "public";
}

export function isCustomerView(view: ViewId): boolean {
  return viewAccessGroups[view] === "customer";
}

export function isSupplierView(view: ViewId): boolean {
  return viewAccessGroups[view] === "supplier";
}

export function isWorkspaceView(view: ViewId): boolean {
  return !["public", "customer", "supplier"].includes(viewAccessGroups[view]);
}

export function canAccessView(view: ViewId, role: string | null): boolean {
  const group = viewAccessGroups[view];
  if (group === "public") return true;
  if (!role) return false;
  if (group === "customer" || group === "supplier") return role === group;
  if (group === "front_desk") return isStaffRole(role);
  if (group === "administrator") return role === "administrator";
  if (group === "staff") return isStaffRole(role);
  return group === "management" && isManagementRole(role);
}

// Old staff URLs for management pages still resolve, but land on their current management route.
export function canonicalView(view: ViewId): ViewId {
  if (view === "inventory") return "admin-inventory";
  if (view === "staff-suppliers") return "admin-suppliers";
  if (view === "restocks") return "admin-restocks";
  return view;
}
