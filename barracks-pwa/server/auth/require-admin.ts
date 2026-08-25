import { timingSafeEqual } from "node:crypto";

function matchesSecret(received: string, configured: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const configuredBuffer = Buffer.from(configured);

  if (receivedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, configuredBuffer);
}

function getPresentedToken(request: Request): string | undefined {
  const headerToken = request.headers.get("X-Admin-Token") ?? undefined;
  const authorization = request.headers.get("Authorization") ?? undefined;

  if (headerToken) return headerToken;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim();
}

export function requireAdministrator(request: Request): Response | null {
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    return Response.json(
      {
        success: false,
        message: "Administrator authorization is not configured",
      },
      { status: 503 },
    );
  }

  const presentedToken = getPresentedToken(request);

  if (!presentedToken || !matchesSecret(presentedToken, configuredToken)) {
    return Response.json(
      {
        success: false,
        message: "Administrator access is required",
      },
      { status: 403 },
    );
  }

  return null;
}
