export type ApiRole = "administrator" | "manager" | "front_desk" | "customer" | "supplier";

export type ApiUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
  isVerified: boolean;
  isBlocked: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiBarber = {
  id: number;
  branchId: number;
  firstName: string;
  lastName: string;
  status: "available" | "busy" | "unavailable";
  commissionRate: number | null;
  servicesDone: number;
  revenue: number;
  rating: number | null;
  scheduleDayCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiBarberAvailability = Pick<ApiBarber, "id" | "firstName" | "lastName" | "status">;

export type ApiAttendance = {
  branchId: number;
  id: number;
  barberId: number;
  barberName: string;
  date: string;
  status: "present" | "late" | "absent";
  clockIn: string | null;
  clockOut: string | null;
  recordedBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiAttendanceCorrection = {
  id: number;
  previousValues: Pick<ApiAttendance, "status" | "clockIn" | "clockOut">;
  newValues: Pick<ApiAttendance, "status" | "clockIn" | "clockOut">;
  reason: string;
  correctedBy: number;
  correctedByName: string;
  createdAt: string;
};

export type ApiInventoryItem = {
  id: number;
  name: string;
  category: "Supplies" | "Equipment" | "Products";
  quantity: number;
  minimumStock: number;
  maximumStock: number | null;
  unitCost: number;
  unit: string;
  sku: string | null;
  status: "active" | "inactive";
  supplierId: number | null;
  supplierName: string | null;
  branch: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiLowStockAlert = {
  id: number;
  itemId: number;
  itemName: string;
  branch: string;
  currentQuantity: number;
  threshold: number;
  unit: string;
};

export type ApiSupplier = {
  id: number;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  hasAccount: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiCustomer = {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredBarberId: number | null;
  preferredBarberName: string | null;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiBookingStatus = "confirmed" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show";

export type ApiBooking = {
  id: number;
  date: string;
  time: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  barberId: number;
  barberName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes: number | null;
  endTime: string | null;
  notes: string | null;
  status: ApiBookingStatus;
  createdAt: string;
  updatedAt: string;
};

export type ApiQueueEntry = {
  id: number;
  bookingId: number | null;
  visitType: "walk_in" | "appointment";
  scheduledDate: string | null;
  scheduledTime: string | null;
  bookingStatus: ApiBookingStatus | null;
  customerId: number;
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId: number | null;
  barberName: string | null;
  status: "waiting" | "ready" | "in_progress" | "completed" | "removed";
  joinedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  success: false;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function apiRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
}

export async function readApiBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
