import type { IconName } from "@/app/components/ui/icons";
import type { NavigationItem, ViewId } from "@/app/types/domain";

export const frontDeskNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "staff-dashboard", label: "Dashboard", icon: "home" },
  { id: "queue", label: "Queue", icon: "queue" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "payments", label: "Payments", icon: "creditCard" },
  { id: "customers", label: "Customers", icon: "users" },
  { id: "barbers", label: "Barber Floor", icon: "scissors" },
];

export const managementNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "admin-dashboard", label: "Dashboard", icon: "home" },
  { id: "admin-branches", label: "Branches", icon: "box" },
  { id: "staff-management", label: "Staff", icon: "briefcase" },
  { id: "admin-customers", label: "Customers", icon: "users" },
  { id: "admin-barbers", label: "Barbers", icon: "scissors" },
  { id: "admin-attendance", label: "Attendance", icon: "calendar" },
  { id: "admin-payroll", label: "Payroll", icon: "creditCard" },
  { id: "admin-suppliers", label: "Suppliers", icon: "shoppingBag" },
  { id: "admin-restocks", label: "Restocks", icon: "stockIn" },
  { id: "admin-reports", label: "Reports", icon: "report" },
  { id: "payments", label: "Transactions", icon: "creditCard" },
  { id: "admin-inventory", label: "Inventory", icon: "box" },
  { id: "admin-services", label: "Services", icon: "comb" },
];

export type ViewAccessGroup = "public" | "customer" | "supplier" | "front_desk" | "staff" | "management" | "administrator";

// Sensitive Administrator-only actions are guarded at the API and control level.
// Keep every page classified here so later navigation changes do not implicitly grant access.
export const viewAccessGroups: Record<ViewId, ViewAccessGroup> = {
  landing: "public",
  login: "public",
  "customer-dashboard": "customer",
  "customer-profile": "customer",
  "customer-booking": "customer",
  "supplier-dashboard": "supplier",
  "staff-dashboard": "front_desk",
  queue: "front_desk",
  bookings: "front_desk",
  payments: "staff",
  customers: "front_desk",
  barbers: "front_desk",
  inventory: "management",
  "staff-suppliers": "management",
  restocks: "management",
  "admin-dashboard": "management",
  "admin-branches": "administrator",
  "staff-management": "management",
  "admin-customers": "management",
  "admin-barbers": "management",
  "admin-attendance": "management",
  "admin-payroll": "management",
  "admin-suppliers": "management",
  "admin-restocks": "management",
  "admin-reports": "management",
  "admin-inventory": "management",
  "admin-services": "management",
};
