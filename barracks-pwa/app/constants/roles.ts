export const userRoles = ["administrator", "front_desk", "customer"] as const;

export const roleOptions = [
  { value: "administrator", label: "Administrator" },
  { value: "front_desk", label: "Front Desk" },
] as const;

export type UserRole = (typeof userRoles)[number];

export function roleLabel(role: string): string {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}
