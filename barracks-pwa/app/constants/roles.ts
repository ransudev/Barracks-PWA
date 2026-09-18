export const userRoles = ["administrator", "manager", "front_desk", "customer", "supplier"] as const;

export const roleOptions = [
  { value: "administrator", label: "Administrator" },
  { value: "manager", label: "Manager" },
  { value: "front_desk", label: "Front Desk" },
] as const;

export type UserRole = (typeof userRoles)[number];

export function roleLabel(role: string): string {
  if (role === "manager") return "Manager";
  if (role === "supplier") return "Supplier";
  if (role === "customer") return "Customer";
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

export function isManagementRole(role: string): boolean {
  return role === "administrator" || role === "manager";
}
