import type { IconName } from "@/app/components/ui/icons";
import type { NavigationItem, ViewId } from "@/app/types/domain";

export const staffNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "staff-dashboard", label: "Dashboard", icon: "home" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "customers", label: "Customers", icon: "users" },
  { id: "barbers", label: "Barbers", icon: "scissors" },
  { id: "inventory", label: "Inventory", icon: "box" },
  { id: "staff-suppliers", label: "Suppliers", icon: "users" },
];

export const adminNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "admin-dashboard", label: "Dashboard", icon: "home" },
  { id: "staff-management", label: "Staff", icon: "users" },
  { id: "admin-customers", label: "Customers", icon: "users" },
  { id: "admin-barbers", label: "Barbers", icon: "scissors" },
  { id: "admin-suppliers", label: "Suppliers", icon: "users" },
  { id: "admin-restocks", label: "Restocks", icon: "calendar" },
  { id: "admin-reports", label: "Reports", icon: "info" },
  { id: "admin-inventory", label: "Inventory", icon: "box" },
];

export const adminViews: ViewId[] = [
  "admin-dashboard",
  "staff-management",
  "admin-customers",
  "admin-barbers",
  "admin-suppliers",
  "admin-restocks",
  "admin-reports",
  "admin-inventory",
];

export const administratorOnlyViews: ViewId[] = [
  "admin-dashboard",
  "staff-management",
  "admin-customers",
  "admin-barbers",
  "admin-suppliers",
  "admin-restocks",
  "admin-reports",
  "admin-inventory",
];
