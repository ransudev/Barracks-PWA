import { requireAdministratorUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import type { PublicUser } from "@/server/services/user.service";
import {
  findUserById,
  softDeleteUser,
  updateStaffUser,
  updateUserLifecycle,
} from "@/server/services/user.service";
import {
  formatValidationErrors,
  updateStaffUserSchema,
  userLifecycleSchema,
} from "@/server/schemas/user.schema";

export const runtime = "nodejs";

function parseUserId(rawId: string): number | Response {
  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return Response.json(
      { success: false, message: "Invalid user id" },
      { status: 400 },
    );
  }
  return Number(rawId);
}

async function allowedTarget(administrator: PublicUser, id: number): Promise<PublicUser | Response> {
  const target = await findUserById(pool, id);
  if (!target) {
    return Response.json({ success: false, message: "User not found" }, { status: 404 });
  }
  if (target.role === "administrator" && target.id !== administrator.id) {
    return Response.json(
      { success: false, message: "You cannot view or manage another administrator account" },
      { status: 403 },
    );
  }
  return target;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

  const id = parseUserId((await params).id);
  if (id instanceof Response) return id;

  try {
    const target = await allowedTarget(administrator, id);
    if (target instanceof Response) return target;
    return Response.json({ success: true, user: target });
  } catch (error) {
    console.error("Unable to load user", error);
    return Response.json({ success: false, message: "Unable to load user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

  const id = parseUserId((await params).id);
  if (id instanceof Response) return id;

  try {
    const target = await allowedTarget(administrator, id);
    if (target instanceof Response) return target;

    const result = await softDeleteUser(pool, id);
    if (result.kind === "not_found") {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }
    if (result.kind === "last_admin") {
      return Response.json(
        { success: false, message: "You cannot deactivate the last administrator account" },
        { status: 409 },
      );
    }
    if (result.kind !== "deleted") {
      return Response.json({ success: false, message: "Unable to deactivate user" }, { status: 500 });
    }
    return Response.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("Unable to delete user", error);
    return Response.json({ success: false, message: "Unable to delete user" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

  const id = parseUserId((await params).id);
  if (id instanceof Response) return id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        message: "Invalid user information",
        errors: { body: ["Request body must be valid JSON"] },
      },
      { status: 400 },
    );
  }

  const parsed = updateStaffUserSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Invalid user information",
        errors: formatValidationErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const target = await allowedTarget(administrator, id);
    if (target instanceof Response) return target;

    const result = await updateStaffUser(pool, id, parsed.data);
    if (result.kind === "not_found") {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }
    if (result.kind === "duplicate") {
      return Response.json({ success: false, message: "A user with this email already exists" }, { status: 409 });
    }
    if (result.kind === "invalid_role") {
      return Response.json({ success: false, message: "The selected user role is not available" }, { status: 400 });
    }
    if (result.kind === "last_admin") {
      return Response.json({ success: false, message: "You must keep at least one administrator account" }, { status: 409 });
    }
    if (result.kind !== "updated") {
      return Response.json({ success: false, message: "Unable to update user" }, { status: 500 });
    }
    return Response.json({ success: true, message: "User account updated", user: result.user });
  } catch (error) {
    console.error("Unable to update user", error);
    return Response.json({ success: false, message: "Unable to update user" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

  const id = parseUserId((await params).id);
  if (id instanceof Response) return id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        message: "Invalid account status update",
        errors: { body: ["Request body must be valid JSON"] },
      },
      { status: 400 },
    );
  }

  const parsed = userLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Invalid account status update",
        errors: formatValidationErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    const target = await allowedTarget(administrator, id);
    if (target instanceof Response) return target;

    const result = await updateUserLifecycle(pool, id, parsed.data);
    if (result.kind === "not_found") {
      return Response.json({ success: false, message: "User not found" }, { status: 404 });
    }
    if (result.kind === "last_admin") {
      return Response.json({ success: false, message: "You cannot disable the last administrator account" }, { status: 409 });
    }
    if (result.kind !== "updated") {
      return Response.json({ success: false, message: "Unable to update account status" }, { status: 500 });
    }
    return Response.json({ success: true, message: "Account status updated", user: result.user });
  } catch (error) {
    console.error("Unable to update user status", error);
    return Response.json({ success: false, message: "Unable to update account status" }, { status: 500 });
  }
}
