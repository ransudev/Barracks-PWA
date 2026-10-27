import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { canCreateStaffUser, canViewStaffUser } from "@/app/constants/roles";
import {
  createStaffUserSchema,
  formatValidationErrors,
} from "@/server/schemas/user.schema";
import { createStaffUser, listStaffUsers, listStaffBranches } from "@/server/services/user.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const manager = await requireManagementUser();
  if (manager instanceof Response) return manager;

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

  const parsed = createStaffUserSchema.safeParse(body);

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

  if (!canCreateStaffUser(manager.role, parsed.data.role)) {
    return Response.json(
      { success: false, message: "You do not have permission to create this staff role" },
      { status: 403 },
    );
  }

  try {
    const result = await createStaffUser(pool, manager.id, parsed.data);

    if (result.kind === "forbidden") return Response.json({success:false,message:"Choose explicit branches within your staff authority"},{status:403});
    if (result.kind === "duplicate") {
      return Response.json(
        {
          success: false,
          message: "A user with this email already exists",
        },
        { status: 409 },
      );
    }

    if (result.kind === "invalid_role") {
      return Response.json(
        {
          success: false,
          message: "The selected user role is not available",
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        success: true,
        message: "User created successfully",
        user: result.user,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to create user", error);
    return Response.json(
      {
        success: false,
        message: "Unable to create user",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const manager = await requireManagementUser();
  if (manager instanceof Response) return manager;

  try {
    const users = await listStaffUsers(pool, manager.id);
    const visibleUsers = users.filter((user) => canViewStaffUser(manager.role, user.role));
    return Response.json({ success: true, users: visibleUsers, branches: await listStaffBranches(pool, manager.id) });
  } catch (error) {
    console.error("Unable to list users", error);
    return Response.json(
      {
        success: false,
        message: "Unable to load users",
      },
      { status: 500 },
    );
  }
}
