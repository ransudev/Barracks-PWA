export type ApiRole = "administrator" | "barber" | "front_desk";

export type ApiUser = {
  userID: number;
  username: string;
  role: ApiRole;
  lastLogin: string | null;
  active: boolean;
};

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"
).replace(/\/$/, "");

export async function apiRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN;

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (adminToken) {
    headers.set("Authorization", `Bearer ${adminToken}`);
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
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
