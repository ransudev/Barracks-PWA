import { Hono } from "hono";
import { pool } from "../db/pool.js";
import { requireAdministrator } from "../middleware/admin.js";
import {
  createUserSchema,
  formatValidationErrors,
} from "../schemas/user.schema.js";
import {
  createUser,
  findUserById,
  listUsers,
} from "../services/user.service.js";

export const usersRoute = new Hono();

usersRoute.use("*", requireAdministrator);

usersRoute.post("/", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        message: "Invalid user information",
        errors: { body: ["Request body must be valid JSON"] },
      },
      400,
    );
  }

  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Invalid user information",
        errors: formatValidationErrors(parsed.error),
      },
      400,
    );
  }

  try {
    const result = await createUser(pool, parsed.data);

    if (result.kind === "duplicate") {
      return c.json(
        {
          success: false,
          message: "A user with this email already exists",
        },
        409,
      );
    }

    if (result.kind === "invalid_role") {
      return c.json(
        {
          success: false,
          message: "The selected user role is not available",
        },
        400,
      );
    }

    return c.json(
      {
        success: true,
        message: "User created successfully",
        user: result.user,
      },
      201,
    );
  } catch (error) {
    console.error("Unable to create user", error);
    return c.json(
      {
        success: false,
        message: "Unable to create user",
      },
      500,
    );
  }
});

usersRoute.get("/", async (c) => {
  try {
    const users = await listUsers(pool);
    return c.json({ success: true, users });
  } catch (error) {
    console.error("Unable to list users", error);
    return c.json(
      {
        success: false,
        message: "Unable to load users",
      },
      500,
    );
  }
});

usersRoute.get("/:id", async (c) => {
  const rawId = c.req.param("id");

  if (!/^\d+$/.test(rawId) || Number(rawId) < 1) {
    return c.json(
      {
        success: false,
        message: "Invalid user id",
      },
      400,
    );
  }

  try {
    const user = await findUserById(pool, Number(rawId));

    if (!user) {
      return c.json(
        {
          success: false,
          message: "User not found",
        },
        404,
      );
    }

    return c.json({ success: true, user });
  } catch (error) {
    console.error("Unable to load user", error);
    return c.json(
      {
        success: false,
        message: "Unable to load user",
      },
      500,
    );
  }
});
