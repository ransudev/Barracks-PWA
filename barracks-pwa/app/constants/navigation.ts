import type { IconName } from "@/app/components/ui/icons";
import type { NavigationItem, ViewId } from "@/app/types/domain";

export const staffNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "staff-dashboard", label: "Dashboard", icon: "home" },
  { id: "queue", label: "Queue", icon: "queue" },
  { id: "bookings", label: "Bookings", icon: "calendar" },
  { id: "payments", label: "Payments", icon: "creditCard" },
  { id: "customers", label: "Customers", icon: "users" },
  { id: "barbers", label: "Barbers", icon: "scissors" },
  { id: "inventory", label: "Inventory", icon: "box" },
  { id: "staff-suppliers", label: "Suppliers", icon: "shoppingBag" },
  { id: "restocks", label: "Restocks", icon: "stockIn" },
];

export const adminNavigation: Array<NavigationItem & { icon: IconName }> = [
  { id: "admin-dashboard", label: "Dashboard", icon: "home" },
  { id: "staff-management", label: "Staff", icon: "briefcase" },
  { id: "admin-customers", label: "Customers", icon: "users" },
  { id: "admin-barbers", label: "Barbers", icon: "scissors" },
  { id: "admin-suppliers", label: "Suppliers", icon: "shoppingBag" },
  { id: "admin-restocks", label: "Restocks", icon: "stockIn" },
  { id: "admin-reports", label: "Reports", icon: "report" },
  { id: "payments", label: "Payments", icon: "creditCard" },
  { id: "admin-inventory", label: "Inventory", icon: "box" },
  { id: "admin-services", label: "Services", icon: "comb" },
];

export const managerNavigation = adminNavigation;

export const adminViews: ViewId[] = [
  "admin-dashboard",
  "staff-management",
  "admin-customers",
  "admin-barbers",
  "admin-suppliers",
  "admin-restocks",
  "admin-reports",
  "admin-inventory",
  "admin-services",
];

export const administratorOnlyViews: ViewId[] = [
];

export const managementOnlyViews: ViewId[] = adminViews.filter((view) => !administratorOnlyViews.includes(view));
