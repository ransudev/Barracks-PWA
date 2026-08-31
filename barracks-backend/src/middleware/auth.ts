import type { MiddlewareHandler } from "hono";
import { pool } from "../db/pool.js";
import { findUserById } from "../services/user.service.js";
import type { UserRole } from "../schemas/user.schema.js";
import { verifyToken, type JWTPayload } from "../services/jwt.service.js";

export interface AuthContext {
  userid: number;
  userRole: UserRole;
}

export type AuthEnv = {
  Variables: {
    auth: AuthContext;
  };
};

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        message: "Authentication is required",
      },
      401,
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return c.json(
      {
        success: false,
        message: "Authentication is required",
      },
      401,
    );
  }

  const payload = verifyToken(token);

  if (!payload) {
    return c.json(
      {
        success: false,
        message: "Invalid or expired authentication token",
      },
      401,
    );
  }

  try {
    const user = await findUserById(pool, payload.userid);

    if (!user) {
      return c.json(
        {
          success: false,
          message: "Invalid authentication token",
        },
        401,
      );
    }

    if (!user.active) {
      return c.json(
        {
          success: false,
          message: "User account is deactivated",
        },
        403,
      );
    }

    c.set("auth", { userid: user.userID, userRole: user.role as UserRole } as AuthContext);
    await next();
  } catch (error) {
    return c.json(
      {
        success: false,
        message: "Invalid authentication token",
      },
      401,
    );
  }
};

export const requireRole = (...allowedRoles: UserRole[]): MiddlewareHandler<AuthEnv> => {
  return async (c, next) => {
    const auth = c.get("auth");

    if (!auth) {
      return c.json(
        {
          success: false,
          message: "Authentication is required",
        },
        401,
      );
    }

    if (!auth.userRole || !allowedRoles.includes(auth.userRole)) {
      return c.json(
        {
          success: false,
          message: "You do not have permission to access this resource",
        },
        403,
      );
    }

    await next();
  };
};
