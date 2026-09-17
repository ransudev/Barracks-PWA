import { requireAdministratorUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import {
  createStaffUserSchema,
  formatValidationErrors,
} from "@/server/schemas/user.schema";
import { createUser, listUsers } from "@/server/services/user.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

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

  try {
    const result = await createUser(pool, parsed.data);

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
  const administrator = await requireAdministratorUser();
  if (administrator instanceof Response) return administrator;

  try {
    const users = await listUsers(pool);
    const visibleUsers = users.filter(
      (user) => user.role !== "administrator" || user.id === administrator.id,
    );
    return Response.json({ success: true, users: visibleUsers });
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
