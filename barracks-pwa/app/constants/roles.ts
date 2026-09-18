export const userRoles = ["administrator", "front_desk", "customer", "supplier"] as const;

export const roleOptions = [
  { value: "administrator", label: "Administrator" },
  { value: "front_desk", label: "Front Desk" },
] as const;

export type UserRole = (typeof userRoles)[number];

export function roleLabel(role: string): string {
  if (role === "supplier") return "Supplier";
  if (role === "customer") return "Customer";
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}
