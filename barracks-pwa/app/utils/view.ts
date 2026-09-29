import { viewAccessGroups } from "@/app/constants/navigation";
import { isManagementRole, isStaffRole } from "@/app/constants/roles";
import type { ViewId } from "@/app/types/domain";

export function isAdminView(view: ViewId) {
  return requiresManagement(view) || requiresAdministrator(view);
}

export function requiresAdministrator(view: ViewId) {
  return viewAccessGroups[view] === "administrator";
}

export function requiresManagement(view: ViewId) {
  return viewAccessGroups[view] === "management";
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
  if (group === "front_desk") return role === "front_desk" || role === "administrator";
  if (group === "staff") return isStaffRole(role);
  if (group === "management") return isManagementRole(role);
  return role === "administrator";
}
