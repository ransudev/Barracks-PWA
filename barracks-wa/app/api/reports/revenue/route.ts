import { branchApiError } from "@/server/services/branch-api";
import { z } from "zod";
import { requireManagementUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { getRevenueReport } from "@/server/services/revenue-report.service";

export const runtime = "nodejs";

const rangeSchema = z.object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => from <= to);

function manilaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}

export async function GET(request: Request) {
  const actor = await requireManagementUser();
  if (actor instanceof Response) return actor;
  const params = new URL(request.url).searchParams;
  const today = manilaToday();
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const parsed = rangeSchema.safeParse({ from: params.get("from") ?? start.toISOString().slice(0, 10),
    to: params.get("to") ?? today });
  if (!parsed.success) return Response.json({ success: false, message: "Invalid report date range" }, { status: 400 });
  try {
    return Response.json({ success: true, ...await getRevenueReport(pool, parsed.data, actor, params.get("branchId")) });
  } catch (error) {
    return branchApiError(error);
  }
}
