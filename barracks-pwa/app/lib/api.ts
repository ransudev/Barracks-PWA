export type ApiRole = "administrator" | "front_desk" | "customer" | "supplier";

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
  firstName: string;
  lastName: string;
  status: "available" | "busy" | "unavailable";
  commissionRate: number | null;
  servicesDone: number;
  revenue: number;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiBarberAvailability = Pick<ApiBarber, "id" | "firstName" | "lastName" | "status">;

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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
};

export type ApiCustomer = {
  id: number;
  userId: number;
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

export type ApiBookingStatus = "upcoming" | "completed" | "cancelled";

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
  status: ApiBookingStatus;
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
