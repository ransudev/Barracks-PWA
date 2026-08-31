import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { usersRoute } from "./routes/users.js";
import { authRoute } from "./routes/auth.js";
import { barberRoute } from "./routes/barber.js";
import { frontDeskRoute } from "./routes/frontDesk.js";
import { dashboardRoute } from "./routes/dashboard.js";

export const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ success: true, service: "barracks-backend" }));
app.route("/api/auth", authRoute);
app.route("/api/users", usersRoute);
app.route("/api/barber", barberRoute);
app.route("/api/frontdesk", frontDeskRoute);
app.route("/api/dashboard", dashboardRoute);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  console.log(`Barracks backend listening on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
