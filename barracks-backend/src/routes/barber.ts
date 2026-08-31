import { Hono } from "hono";
import { requireAuth, requireRole, type AuthEnv } from "../middleware/auth.js";

export const barberRoute = new Hono<AuthEnv>();

barberRoute.use("*", requireAuth);
barberRoute.use("*", requireRole("barber"));

barberRoute.get("/appointments", async (c) => {
  // Placeholder for barber-specific appointment management
  return c.json({
    success: true,
    message: "Barber appointments endpoint",
    data: [],
  });
});

barberRoute.get("/schedule", async (c) => {
  // Placeholder for barber schedule management
  return c.json({
    success: true,
    message: "Barber schedule endpoint",
    data: [],
  });
});