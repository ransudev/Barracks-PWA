export type ApiRole = "administrator" | "front_desk" | "customer";

export type ApiUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
  createdAt: string;
  updatedAt: string;
};

export type ApiBarber = {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  status: "available" | "busy" | "unavailable";
  commissionRate: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiInventoryItem = {
  id: number;
  name: string;
  category: "Supplies" | "Equipment" | "Products";
  quantity: number;
  minimumStock: number;
  unitCost: number;
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
