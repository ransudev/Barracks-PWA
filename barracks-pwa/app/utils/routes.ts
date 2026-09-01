import type { ViewId } from "@/app/types/domain";

export const viewPaths: Record<ViewId, string> = {
  landing: "/",
  login: "/login",
  "customer-dashboard": "/customer/dashboard",
  "customer-profile": "/customer/profile",
  "customer-booking": "/customer/book-appointment",
  "staff-dashboard": "/staff/dashboard",
  queue: "/staff/queue",
  bookings: "/staff/bookings",
  customers: "/staff/customers",
  payment: "/staff/payment",
  inventory: "/staff/inventory",
  "staff-settings": "/staff/settings",
  "admin-dashboard": "/admin/dashboard",
  "staff-management": "/admin/staff",
  "admin-customers": "/admin/customers",
  "admin-barbers": "/admin/barbers",
  barbers: "/staff/barbers",
  services: "/admin/services",
  reports: "/admin/reports",
  "admin-inventory": "/admin/inventory",
  "admin-settings": "/admin/settings",
};

const pathsToViews = new Map(
  Object.entries(viewPaths).map(([view, path]) => [path, view as ViewId]),
);

export function pathForView(view: ViewId): string {
  return viewPaths[view];
}

export function viewForPath(pathname: string): ViewId {
  return pathsToViews.get(pathname) ?? "landing";
}

export function isKnownAppPath(pathname: string): boolean {
  return pathsToViews.has(pathname);
}
