import { getCurrentUser } from "@/server/auth/session";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "Authentication is required",
        },
        { status: 401, headers: noStoreHeaders },
      );
    }

    return Response.json({ success: true, user }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("Unable to load current user", error);
    return Response.json(
      {
        success: false,
        message: "Unable to load current user",
      },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
