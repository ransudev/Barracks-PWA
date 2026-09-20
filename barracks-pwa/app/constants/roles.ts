export const userRoles = ["administrator", "manager", "front_desk", "customer", "supplier"] as const;

export const roleOptions = [
  { value: "administrator", label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "front_desk", label: "Front Desk" },
] as const;

export type UserRole = (typeof userRoles)[number];

export type BookingAction = "edit" | "cancel" | "complete" | "delete";

export function roleLabel(role: string): string {
  if (role === "manager") return "Manager";
  if (role === "supplier") return "Supplier";
  if (role === "customer") return "Customer";
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

export function isManagementRole(role: string): boolean {
  return role === "administrator" || role === "manager";
}

export function isStaffRole(role: string): boolean {
  return role === "administrator" || role === "manager" || role === "front_desk";
}

export function canViewStaffUser(actorRole: string, targetRole: string): boolean {
  return isStaffRole(targetRole)
    && (actorRole === "administrator" || (actorRole === "manager" && targetRole !== "administrator"));
}

export function canCreateStaffUser(actorRole: string, desiredRole: string): boolean {
  return actorRole === "administrator"
    ? isStaffRole(desiredRole)
    : actorRole === "manager" && desiredRole === "front_desk";
}

export function canUpdateStaffUser(
  actorRole: string,
  targetRole: string,
  actorId: number,
  targetId: number,
  desiredRole: string,
): boolean {
  if (!isStaffRole(targetRole) || !isStaffRole(desiredRole)) return false;
  return actorRole === "administrator"
    || (actorRole === "manager" && actorId !== targetId && targetRole === "front_desk" && desiredRole === "front_desk");
}

export function canChangeStaffLifecycle(
  actorRole: string,
  targetRole: string,
  actorId: number,
  targetId: number,
): boolean {
  if (!isStaffRole(targetRole)) return false;
  return actorRole === "administrator"
    || (actorRole === "manager" && actorId !== targetId && targetRole === "front_desk");
}

export function canDeactivateStaffUser(
  actorRole: string,
  targetRole: string,
  actorId: number,
  targetId: number,
): boolean {
  if (!isStaffRole(targetRole) || actorId === targetId) return false;
  return actorRole === "administrator"
    || (actorRole === "manager" && targetRole === "front_desk");
}

export function canManageBooking(actorRole: string, action: BookingAction, ownsBooking = false): boolean {
  if (isManagementRole(actorRole)) return true;
  if (actorRole === "front_desk") return action !== "delete";
  return actorRole === "customer" && ownsBooking && (action === "edit" || action === "cancel");
}
