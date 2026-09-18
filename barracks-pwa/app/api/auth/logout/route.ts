import { NextResponse } from "next/server";
import { clearSessionCookie, endSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Signed out",
  });

  try {
    await endSession(response);
    return response;
  } catch (error) {
    console.error("Unable to sign out", error);
    const errorResponse = NextResponse.json(
      {
        success: false,
        message: "Unable to sign out",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
    clearSessionCookie(errorResponse);
    return errorResponse;
  }
}
