import { z } from "zod";
import { requireRoles } from "@/server/auth/require-role";
import { revenueReportRoles } from "@/server/auth/revenue-report-roles";
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
  const denied = await requireRoles(revenueReportRoles);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const today = manilaToday();
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const parsed = rangeSchema.safeParse({ from: params.get("from") ?? start.toISOString().slice(0, 10),
    to: params.get("to") ?? today });
  if (!parsed.success) return Response.json({ success: false, message: "Invalid report date range" }, { status: 400 });
  try {
    return Response.json({ success: true, ...await getRevenueReport(pool, parsed.data) });
  } catch (error) {
    console.error("Unable to load revenue reports", error);
    return Response.json({ success: false, message: "Unable to load revenue reports" }, { status: 500 });
  }
}
