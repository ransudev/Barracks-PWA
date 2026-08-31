import { Hono } from "hono";
import { pool } from "../db/pool.js";
import { loginSchema, formatValidationErrors } from "../schemas/user.schema.js";
import { loginUser, findUserById } from "../services/user.service.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";
import { generateToken } from "../services/jwt.service.js";

export const authRoute = new Hono();

authRoute.post("/login", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        message: "Invalid request body",
        errors: { body: ["Request body must be valid JSON"] },
      },
      400,
    );
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        message: "Invalid login information",
        errors: formatValidationErrors(parsed.error),
      },
      400,
    );
  }

  try {
    console.log("Login attempt for username:", parsed.data.username);
    const result = await loginUser(pool, parsed.data.username, parsed.data.password);
    console.log("Login result kind:", result.kind);

    if (result.kind === "invalid_credentials") {
      return c.json(
        {
          success: false,
          message: "Invalid username or password",
        },
        401,
      );
    }

    if (result.kind === "inactive") {
      return c.json(
        {
          success: false,
          message: "Your account has been deactivated. Please contact an administrator.",
        },
        403,
      );
    }

    const token = generateToken({
      userid: result.user.userID,
      role: result.user.role,
    });

    return c.json(
      {
        success: true,
        message: "Login successful",
        user: result.user,
        token,
      },
      200,
    );
  } catch (error) {
    console.error("Unable to process login", error);
    return c.json(
      {
        success: false,
        message: "Unable to process login",
      },
      500,
    );
  }
});

authRoute.post("/logout", requireAuth, async (c) => {
  const auth = c.get("auth");

  try {
    // JWT tokens are stateless, so we can't invalidate them on the server side
    // The frontend should discard the token to complete the logout
    // For enhanced security, consider implementing a token blacklist for logout

    return c.json(
      {
        success: true,
        message: "Logout successful",
      },
      200,
    );
  } catch (error) {
    console.error("Unable to process logout", error);
    return c.json(
      {
        success: false,
        message: "Unable to process logout",
      },
      500,
    );
  }
});
