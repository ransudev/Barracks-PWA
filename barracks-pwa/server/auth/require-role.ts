import { getCurrentUser } from "@/server/auth/session";
import type { UserRole } from "@/server/schemas/user.schema";

export async function requireRoles(
  allowedRoles: readonly UserRole[],
): Promise<Response | null> {
  let user;

  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Unable to authenticate request", error);
    return Response.json(
      { success: false, message: "Unable to authenticate request" },
      { status: 500 },
    );
  }

  if (!user) {
    return Response.json(
      { success: false, message: "Authentication is required" },
      { status: 401 },
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return Response.json(
      { success: false, message: "You do not have access to this resource" },
      { status: 403 },
    );
  }

  return null;
}

export async function requireStaff(): Promise<Response | null> {
  return requireRoles(["administrator", "front_desk"]);
}
