import { NextResponse } from "next/server";
import { startSession } from "@/server/auth/session";
import { pool } from "@/server/db/pool";
import {
  formatValidationErrors,
  loginSchema,
} from "@/server/schemas/user.schema";
import { findUserByEmail } from "@/server/services/user.service";
import { verifyPassword } from "@/server/services/password.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid login information",
        errors: { body: ["Request body must be valid JSON"] },
      },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid login information",
        errors: formatValidationErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const account = await findUserByEmail(pool, parsed.data.email);

    if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      user: account.user,
    });
    await startSession(response, account.user.id);
    return response;
  } catch (error) {
    console.error("Unable to sign in", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to sign in",
      },
      { status: 500 },
    );
  }
}
