import { getInventoryReport } from "@/server/services/inventory-report.service";
import { branchApiError } from "@/server/services/branch-api";
import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";

export const runtime = "nodejs";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || dateOnly(date) !== raw ? null : date;
}

export async function GET(request: Request) {
  const user = await requireManagementUser();
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const from = rawFrom ? parseDate(rawFrom) : defaultFrom;
  const to = rawTo ? parseDate(rawTo) : today;
  if (!from || !to || from > to) {
    return Response.json({ success: false, message: "Invalid report date range" }, { status: 400 });
  }

  try {
    return Response.json(await getInventoryReport(pool, user, from, to, url.searchParams.get("branchId")));
  } catch (error) {
    return branchApiError(error);
  }
}
