import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { usersRoute } from "./routes/users.js";

export const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ success: true, service: "barracks-backend" }));
app.route("/api/users", usersRoute);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  console.log(`Barracks backend listening on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
