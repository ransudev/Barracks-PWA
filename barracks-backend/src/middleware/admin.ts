import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

function matchesSecret(received: string, configured: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const configuredBuffer = Buffer.from(configured);

  if (receivedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, configuredBuffer);
}

function getPresentedToken(authorization: string | undefined, headerToken: string | undefined) {
  if (headerToken) return headerToken;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim();
}

export const requireAdministrator: MiddlewareHandler = async (c, next) => {
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    return c.json(
      {
        success: false,
        message: "Administrator authorization is not configured",
      },
      503,
    );
  }

  const presentedToken = getPresentedToken(
    c.req.header("Authorization"),
    c.req.header("X-Admin-Token"),
  );

  if (!presentedToken || !matchesSecret(presentedToken, configuredToken)) {
    return c.json(
      {
        success: false,
        message: "Administrator access is required",
      },
      403,
    );
  }

  await next();
};
