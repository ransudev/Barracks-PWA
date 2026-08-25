import { getCurrentUser } from "@/server/auth/session";

export async function requireAdministrator(): Promise<Response | null> {
  let user;

  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Unable to authenticate request", error);
    return Response.json(
      {
        success: false,
        message: "Unable to authenticate request",
      },
      { status: 500 },
    );
  }

  if (!user) {
    return Response.json(
      {
        success: false,
        message: "Authentication is required",
      },
      { status: 401 },
    );
  }

  if (user.role !== "administrator") {
    return Response.json(
      {
        success: false,
        message: "Administrator access is required",
      },
      { status: 403 },
    );
  }

  return null;
}
