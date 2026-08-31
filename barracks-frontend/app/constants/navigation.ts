import type { IconName } from "@/app/components/ui/icons";
import type { NavigationItem, ViewId } from "@/app/types/domain";

export const staffNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "staff-dashboard", label: "Overview", icon: "home" },
  { id: "queue", label: "Queue", icon: "queue" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "customers", label: "Customers", icon: "users" },
  { id: "payment", label: "Payment", icon: "wallet" },
  { id: "inventory", label: "Inventory", icon: "box" },
];

export const adminNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "admin-dashboard", label: "Dashboard", icon: "home" },
  { id: "staff-management", label: "Staff", icon: "users" },
  { id: "barbers", label: "Barbers", icon: "scissors" },
  { id: "services", label: "Services", icon: "briefcase" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "admin-inventory", label: "Inventory", icon: "box" },
];

export const adminViews: ViewId[] = [
  "admin-dashboard",
  "staff-management",
  "barbers",
  "services",
  "reports",
  "admin-inventory",
  "admin-settings",
];
