"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading, TextField } from "@/app/components/ui";
import type { RevenueGroup, RevenueReport } from "@/server/services/revenue-report.service";

type ReportBody = RevenueReport & { success: boolean; message?: string };

function defaultDates() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: today };
}

function Breakdown({ title, description, rows }: { title: string; description: string; rows: RevenueGroup[] }) {
  return <Panel>
    <SectionHeading title={title} description={description} />
    {rows.length ? <div className="staff-table staff-table--cols-5">
      <div className="staff-table__head"><span>{title === "Daily sales" ? "Date" : "Group"}</span><span>Transactions</span><span>Gross sales</span><span>Refunded / voided</span><span>Net revenue</span></div>
      {rows.map((row) => <div className="staff-table__row" key={row.label}>
        <span><strong>{row.label}</strong></span><span>{row.transactionCount}</span>
        <span>{formatCurrency(row.grossSales)}</span>
        <span>{formatCurrency(row.reversedAmount)}<small>{formatCurrency(row.refundedAmount)} refunded · {formatCurrency(row.voidedAmount)} voided</small></span>
        <span><strong>{formatCurrency(row.netRevenue)}</strong></span>
      </div>)}
    </div> : <EmptyState icon="creditCard" title="No sales or reversals in this period" description="Choose another date range or check out a completed visit." />}
  </Panel>;
}

export function RevenueReports({ onToast }: { onToast: (message: string) => void }) {
  const defaults = useMemo(() => defaultDates(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [range, setRange] = useState(defaults);
  const [data, setData] = useState<ReportBody | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selected: { from: string; to: string }) => {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams(selected);
      const response = await apiRequest(`/api/reports/revenue?${params}`, { cache: "no-store" });
      const body = await readApiBody<ReportBody>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load revenue reports");
      setData(body);
    } catch (error) { onToast(error instanceof Error ? error.message : "Unable to load revenue reports"); }
    finally { setLoading(false); }
  }, [onToast]);

  useEffect(() => {
    // The request updates report state after the external API resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(range);
  }, [range, load]);

  function applyRange(event: FormEvent) {
    event.preventDefault();
    if (!from || !to || from > to) { onToast("Choose a valid report date range"); return; }
    setRange({ from, to });
  }

  return <>
    <PageHeader title="Sales & revenue" description="Paid service sales and financial reversals from persisted transactions." />
    <Panel className="inventory-report-period-panel">
      <form className="panel-toolbar panel-toolbar--period" onSubmit={applyRange}>
        <TextField label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button type="submit" disabled={loading}>{loading ? "Loading…" : "Apply period"}</Button>
      </form>
      <p>Sales use the checkout date; refunds and voids use the action date. Older reversed records without an action date use their sale date. Dates are in Manila time.</p>
    </Panel>
    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Gross sales" value={loading || !data ? "—" : formatCurrency(data.summary.grossSales)} icon="creditCard" accent="blue" />
      <MetricCard label="Refunded / voided" value={loading || !data ? "—" : formatCurrency(data.summary.reversedAmount)} icon="info" accent="amber" />
      <MetricCard label="Net revenue" value={loading || !data ? "—" : formatCurrency(data.summary.netRevenue)} icon="check" accent="green" />
      <MetricCard label="Transactions" value={loading || !data ? "—" : String(data.summary.transactionCount)} icon="info" accent="violet" />
    </div>
    {!loading && data && <>
      <Breakdown title="Daily sales" description="Daily checkout and reversal activity in Manila time." rows={data.dailySales} />
      <Breakdown title="Revenue by service" description="Uses the service name saved on each transaction." rows={data.byService} />
      <Breakdown title="Revenue by barber" description="Uses the barber name saved on each transaction." rows={data.byBarber} />
      <Breakdown title="Revenue by payment method" description="Uses the payment method saved on each transaction." rows={data.byPaymentMethod} />
    </>}
  </>;
}
