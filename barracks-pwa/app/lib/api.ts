export type ApiRole = "administrator" | "barber" | "front_desk";

export type ApiUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
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
