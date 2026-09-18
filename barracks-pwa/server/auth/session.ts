import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { pool } from "@/server/db/pool";
import {
  createSession,
  deleteSession,
  findUserBySessionToken,
  SESSION_COOKIE_NAME,
} from "@/server/services/session.service";
import type { PublicUser } from "@/server/services/user.service";

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  return findUserBySessionToken(pool, token);
}

export async function startSession(
  response: NextResponse,
  userId: number,
): Promise<void> {
  const { token, expiresAt } = await createSession(pool, userId);

  response.cookies.set({
    ...sessionCookieOptions,
    name: SESSION_COOKIE_NAME,
    value: token,
    expires: expiresAt,
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
}

export async function endSession(response: NextResponse): Promise<void> {
  try {
    const token = await getSessionToken();

    if (token) {
      await deleteSession(pool, token);
    }
  } finally {
    clearSessionCookie(response);
  }
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    ...sessionCookieOptions,
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    maxAge: 0,
  });
}
