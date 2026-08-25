import { requireAdministrator } from "@/server/auth/require-admin";
import { pool } from "@/server/db/pool";
import {
  createUserSchema,
  formatValidationErrors,
} from "@/server/schemas/user.schema";
import { createUser, listUsers } from "@/server/services/user.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorizationResponse = requireAdministrator(request);

  if (authorizationResponse) {
    return authorizationResponse;
  }

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

  const parsed = createUserSchema.safeParse(body);

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

export async function GET(request: Request) {
  const authorizationResponse = requireAdministrator(request);

  if (authorizationResponse) {
    return authorizationResponse;
  }

  try {
    const users = await listUsers(pool);
    return Response.json({ success: true, users });
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
