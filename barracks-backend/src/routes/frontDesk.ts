import { Hono } from "hono";
import { requireAuth, requireRole, type AuthEnv } from "../middleware/auth.js";

export const frontDeskRoute = new Hono<AuthEnv>();

frontDeskRoute.use("*", requireAuth);
frontDeskRoute.use("*", requireRole("front_desk"));

frontDeskRoute.get("/appointments", async (c) => {
  // Placeholder for front desk appointment management
  return c.json({
    success: true,
    message: "Front desk appointments endpoint",
    data: [],
  });
});

frontDeskRoute.get("/customers", async (c) => {
  // Placeholder for front desk customer management
  return c.json({
    success: true,
    message: "Front desk customers endpoint",
    data: [],
  });
});