import { getCurrentUser } from "@/server/auth/session";
import type { UserRole } from "@/server/schemas/user.schema";
import type { PublicUser } from "@/server/services/user.service";

async function getAuthorizedUser(
  allowedRoles: readonly UserRole[],
): Promise<PublicUser | Response> {
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

  return user;
}

export async function requireRolesUser(
  allowedRoles: readonly UserRole[],
): Promise<PublicUser | Response> {
  return getAuthorizedUser(allowedRoles);
}

export async function requireRoles(
  allowedRoles: readonly UserRole[],
): Promise<Response | null> {
  const result = await requireRolesUser(allowedRoles);
  return result instanceof Response ? result : null;
}

export async function requireStaff(): Promise<Response | null> {
  return requireRoles(["administrator", "manager", "front_desk"]);
}

export async function requireStaffUser(): Promise<PublicUser | Response> {
  return requireRolesUser(["administrator", "manager", "front_desk"]);
}

export async function requireManagement(): Promise<Response | null> {
  return requireRoles(["administrator", "manager"]);
}

export async function requireManagementUser(): Promise<PublicUser | Response> {
  return requireRolesUser(["administrator", "manager"]);
}

export async function requireAdministrator(): Promise<Response | null> {
  return requireRoles(["administrator"]);
}

export async function requireAdministratorUser(): Promise<PublicUser | Response> {
  return requireRolesUser(["administrator"]);
}

export async function requireSupplier(): Promise<Response | null> {
  return requireRoles(["supplier"]);
}

export async function requireSupplierUser(): Promise<PublicUser | Response> {
  return requireRolesUser(["supplier"]);
}
