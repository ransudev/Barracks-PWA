export type Tone = "blue" | "green" | "amber" | "violet" | "red" | "slate";

export type ViewId =
  | "landing"
  | "login"
  | "customer-dashboard"
  | "customer-profile"
  | "customer-booking"
  | "staff-dashboard"
  | "queue"
  | "bookings"
  | "customers"
  | "payment"
  | "inventory"
  | "staff-settings"
  | "admin-dashboard"
  | "staff-management"
  | "barbers"
  | "services"
  | "reports"
  | "admin-inventory"
  | "admin-settings";

export type ShellArea = "staff" | "admin";

export type Barber = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  status: "On floor" | "On break" | "Off today";
  tone: Tone;
  services: number;
  revenue: number;
  commission: number;
  rating: number;
  customers: number;
  memberSince: string;
};

export type Customer = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  email: string;
  visits: number;
  points: number;
  preferredBarber: string;
  lastVisit: string;
  tone: Tone;
};

export type QueueEntry = {
  id: number;
  customer: string;
  initials: string;
  service: string;
  barber: string;
  status: "Waiting" | "In chair" | "Ready";
  wait: string;
  joined: string;
  tone: Tone;
};

export type Booking = {
  id: string;
  time: string;
  meridiem: string;
  customer: string;
  initials: string;
  service: string;
  barber: string;
  price: number;
  status: "Completed" | "Upcoming" | "Cancelled";
  tone: Tone;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: "Supplies" | "Equipment" | "Products";
  current: number;
  minimum: number;
  maximum: number;
  unitCost: number;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: number;
  active: boolean;
};

export type Transaction = {
  id: string;
  date: string;
  customer: string;
  service: string;
  barber: string;
  method: string;
  amount: number;
  status: string;
};

export type StaffMember = {
  id: string;
  name: string;
  initials: string;
  role: "Administrator" | "Front Desk";
  email: string;
  phone: string;
  status: "Active" | "On leave" | "Disabled";
  joined: string;
  tone: Tone;
};

export type RevenueDay = {
  day: string;
  value: number;
};

export type RevenueByService = {
  label: string;
  value: number;
  percent: number;
  tone: Tone;
};

export type NavigationItem = {
  id: ViewId;
  label: string;
  icon: string;
};
