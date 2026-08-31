import { requireAdministrator } from "@/server/auth/require-admin";
import { pool } from "@/server/db/pool";
import { findUserById, softDeleteUser } from "@/server/services/user.service";

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
    if (!(await softDeleteUser(pool, Number(rawId)))) {
      return Response.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 },
      );
    }

    return Response.json({ success: true, message: "User deleted" });
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
