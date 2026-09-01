import { requireAdministrator } from "@/server/auth/require-admin";
import { pool } from "@/server/db/pool";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationResponse = await requireAdministrator();

  if (authorizationResponse) {
    return authorizationResponse;
  }

  const { id: rawId } = await params;

  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return Response.json(
      {
        success: false,
        message: "Invalid user id",
      },
      { status: 400 },
    );
  }

  try {
    const user = await findUserById(pool, Number(rawId));

    if (!user) {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 },
      );
    }

    return Response.json({ success: true, user });
  } catch (error) {
    console.error("Unable to load user", error);
    return Response.json(
      {
        success: false,
        message: "Unable to load user",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationResponse = await requireAdministrator();

  if (authorizationResponse) {
    return authorizationResponse;
  }

  const { id: rawId } = await params;

  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return Response.json(
      {
        success: false,
        message: "Invalid user id",
      },
      { status: 400 },
    );
  }

  try {
    const result = await softDeleteUser(pool, Number(rawId));

    if (result.kind === "not_found") {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 },
      );
    }

    if (result.kind === "last_admin") {
      return Response.json(
        {
          success: false,
          message: "You cannot deactivate the last administrator account",
        },
        { status: 409 },
      );
    }

    if (result.kind !== "deleted") {
      return Response.json({ success: false, message: "Unable to deactivate user" }, { status: 500 });
    }

    return Response.json({ success: true, message: "User deactivated" });
  } catch (error) {
    console.error("Unable to delete user", error);
    return Response.json(
      {
        success: false,
        message: "Unable to delete user",
      },
      { status: 500 },
    );
  }
}

async function parseUserId(rawId: string): Promise<number | Response> {
  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return Response.json(
      { success: false, message: "Invalid user id" },
      { status: 400 },
    );
  }
  return Number(rawId);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;

  const id = await parseUserId((await params).id);
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
  const authorizationResponse = await requireAdministrator();
  if (authorizationResponse) return authorizationResponse;

  const id = await parseUserId((await params).id);
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
