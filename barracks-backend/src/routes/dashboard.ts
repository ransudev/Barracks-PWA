import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";

export const dashboardRoute = new Hono<AuthEnv>();

dashboardRoute.use("*", requireAuth);

dashboardRoute.get("/", async (c) => {
  const auth = c.get("auth");

  return c.json({
    success: true,
    message: "Dashboard accessed successfully",
    user: {
      userID: auth.userid,
      role: auth.userRole,
    },
  });
});