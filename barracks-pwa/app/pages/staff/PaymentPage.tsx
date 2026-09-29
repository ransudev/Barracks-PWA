"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { Button, EmptyState, PageHeader, Panel, SectionHeading, SelectField, TextField } from "@/app/components/ui";
import type { EligibleVisit, TransactionRecord } from "@/server/services/payment.service";
import type { PaymentMethod } from "@/server/schemas/payment.schema";

const methods: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" }, { id: "card", label: "Card" },
  { id: "e_wallet", label: "E-wallet" }, { id: "bank_transfer", label: "Bank transfer" },
  { id: "other", label: "Other" },
];
const visitKey = (visit: EligibleVisit) => `${visit.visitType}:${visit.visitRecordId}`;
const methodLabel = (method: string) => methods.find((item) => item.id === method)?.label ?? method;
const money = (amount: number) => formatCurrency(amount);
const historyUrl = (page: number, search: string, paymentMethod: string, dateFrom: string, dateTo: string) => {
  const params = new URLSearchParams({ view: "history", page: String(page), pageSize: "20" });
  if (search.trim()) params.set("search", search.trim());
  if (paymentMethod) params.set("paymentMethod", paymentMethod);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  return `/api/transactions?${params}`;
};

function Receipt({ transaction, onClose }: { transaction: TransactionRecord; onClose: () => void }) {
  return <section className="receipt-view" aria-label="Receipt">
    <div className="receipt-actions"><Button type="button" onClick={() => window.print()}>Print Receipt</Button><Button type="button" variant="ghost" onClick={onClose}>Close receipt</Button></div>
    <div className="receipt-paper">
      <h2>Barracks</h2><p>Payment receipt</p>
      <dl>
        <dt>Reference</dt><dd>{transaction.reference}</dd>
        <dt>Date/time</dt><dd>{new Date(transaction.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</dd>
        <dt>Customer</dt><dd>{transaction.customerName}</dd>
        <dt>Service</dt><dd>{transaction.serviceName}</dd>
        <dt>Barber</dt><dd>{transaction.barberName}</dd>
        <dt>Cashier</dt><dd>{transaction.cashierName ?? "—"}</dd>
        <dt>Subtotal</dt><dd>{money(transaction.subtotal)}</dd>
        <dt>Total</dt><dd>{money(transaction.total)}</dd>
        <dt>Payment method</dt><dd>{methodLabel(transaction.paymentMethod)}</dd>
        {transaction.paymentMethod === "cash" && <><dt>Amount received</dt><dd>{transaction.amountReceived === null ? "—" : money(transaction.amountReceived)}</dd><dt>Change</dt><dd>{transaction.change === null ? "—" : money(transaction.change)}</dd></>}
        <dt>Payment status</dt><dd>{transaction.paymentStatus}</dd>
        {transaction.actions?.map((action) => <div key={action.id} className="receipt-audit-entry"><dt>{action.action === "refund" ? "Refund" : "Void"}</dt><dd>{money(action.amount)} · {action.reason} · {action.staffName} · {new Date(action.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</dd></div>)}
      </dl>
    </div>
  </section>;
}

export function PaymentPage({ onToast, canManageFinancialActions = false }: { onToast: (message: string) => void; canManageFinancialActions?: boolean }) {
  const [visits, setVisits] = useState<EligibleVisit[]>([]);
  const [history, setHistory] = useState<TransactionRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);
  const printWhenReady = useRef(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [completed, setCompleted] = useState<TransactionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [processing, setProcessing] = useState(false);
  const submitting = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const [visitsResponse, historyResponse] = await Promise.all([
        apiRequest("/api/transactions?view=eligible", { cache: "no-store" }),
        apiRequest(historyUrl(page, search, methodFilter, dateFrom, dateTo), { cache: "no-store" }),
      ]);
      const [visitsBody, historyBody] = await Promise.all([
        readApiBody<{ success: boolean; visits?: EligibleVisit[]; message?: string }>(visitsResponse),
        readApiBody<{ success: boolean; transactions?: TransactionRecord[]; total?: number; totalPages?: number; message?: string }>(historyResponse),
      ]);
      if (!visitsResponse.ok || !visitsBody?.success || !visitsBody.visits ||
          !historyResponse.ok || !historyBody?.success || !historyBody.transactions) {
        throw new Error(visitsBody?.message ?? historyBody?.message ?? "Unable to load payments");
      }
      if (version !== requestVersion.current) return;
      setVisits(visitsBody.visits);
      setHistory(historyBody.transactions);
      setTotal(historyBody.total ?? historyBody.transactions.length);
      setTotalPages(historyBody.totalPages ?? (historyBody.transactions.length ? 1 : 0));
      setSelectedKey((current) => visitsBody.visits!.some((visit) => visitKey(visit) === current) ? current : "");
      setLoadError("");
    } catch (error) {
      if (version === requestVersion.current) setLoadError(error instanceof Error ? error.message : "Unable to load payments");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [page, search, methodFilter, dateFrom, dateTo]);

  useEffect(() => {
    const versionRef = requestVersion;
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; versionRef.current++; };
  }, [load]);

  const selected = visits.find((visit) => visitKey(visit) === selectedKey);
  const received = cashReceived.trim() === "" ? null : Number(cashReceived);
  const cashValid = received !== null && Number.isFinite(received) && received >= 0 &&
    /^\d+(?:\.\d{1,2})?$/.test(cashReceived) && received <= 9_999_999_999.99;
  const sufficient = selected && cashValid && Math.round(received! * 100) >= Math.round(selected.total * 100);
  const change = sufficient ? (Math.round(received! * 100) - Math.round(selected!.total * 100)) / 100 : null;

  useEffect(() => {
    if (receipt && printWhenReady.current) {
      printWhenReady.current = false;
      window.print();
    }
  }, [receipt]);

  async function openReceipt(reference: string, print = false) {
    setReceipt(null);
    setReceiptError("");
    setActionReason("");
    setActionError("");
    printWhenReady.current = false;
    setReceiptLoading(true);
    try {
      const response = await apiRequest(`/api/transactions?reference=${encodeURIComponent(reference)}`, { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; transaction?: TransactionRecord; message?: string }>(response);
      if (!response.ok || !body?.success || !body.transaction) throw new Error(body?.message ?? "Unable to load receipt");
      printWhenReady.current = print;
      setReceipt(body.transaction);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Unable to load receipt");
    } finally { setReceiptLoading(false); }
  }

  async function applyAction(action: "refund" | "void") {
    if (!receipt || actionProcessing || !actionReason.trim()) return;
    setActionProcessing(true);
    setActionError("");
    try {
      const response = await apiRequest("/api/transactions/actions", { method: "POST", body: JSON.stringify({ reference: receipt.reference, action, amount: receipt.total, reason: actionReason.trim() }) });
      const body = await readApiBody<{ success: boolean; transaction?: TransactionRecord; message?: string }>(response);
      if (!response.ok || !body?.success || !body.transaction) throw new Error(body?.message ?? "Unable to update transaction");
      setReceipt(body.transaction);
      setActionReason("");
      onToast(`Transaction ${body.transaction.status}: ${body.transaction.reference}`);
      await load();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to update transaction"); }
    finally { setActionProcessing(false); }
  }

  async function checkout() {
    if (submitting.current || !selected || (method === "cash" && !sufficient)) return;
    submitting.current = true;
    setProcessing(true);
    setCheckoutError("");
    const visit = selected.visitType === "booking" ? { bookingId: selected.visitRecordId } : { queueEntryId: selected.visitRecordId };
    const payload = method === "cash"
      ? { visit, paymentMethod: method, amountReceived: received }
      : { visit, paymentMethod: method };
    try {
      const response = await apiRequest("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; transaction?: TransactionRecord; message?: string }>(response);
      if (!response.ok || !body?.success || !body.transaction) {
        throw new Error(body?.message ?? (response.status === 409 ? "This visit has already been paid or is no longer eligible." : "Unable to complete payment"));
      }
      setCompleted(body.transaction);
      setSelectedKey("");
      setCashReceived("");
      onToast(`Payment completed: ${body.transaction.reference}`);
      await load();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to complete payment");
      if (error instanceof Error && /already exists|already been paid/i.test(error.message)) void load();
    } finally {
      submitting.current = false;
      setProcessing(false);
    }
  }

  return <>
    <PageHeader title="Payments" description="Check out completed visits." action={<Button type="button" variant="ghost" icon="refresh" disabled={loading || processing} onClick={() => void load()}>Refresh</Button>} />
    {loadError && <p role="alert">{loadError}</p>}
    <div className="payment-grid">
      <Panel className="payment-form-panel">
        <SectionHeading title="Checkout" />
        {loading && <p>Loading eligible visits…</p>}
        {!loading && !visits.length && <EmptyState title="No visits ready for payment" description="Completed unpaid bookings and walk-ins will appear here." />}
        {!!visits.length && <>
          <SelectField label="Completed visit" value={selectedKey} disabled={processing} onChange={(event) => { setSelectedKey(event.target.value); setCompleted(null); setCheckoutError(""); }}>
            <option value="">Select a visit</option>
            {visits.map((visit) => <option key={visitKey(visit)} value={visitKey(visit)}>{visit.visitType === "booking" ? "Booking" : "Walk-in"} #{visit.visitRecordId} · {visit.customerName} · {visit.serviceName}</option>)}
          </SelectField>
          {selected && <>
            <div className="payment-summary">
              <span><small>Customer</small><strong>{selected.customerName}</strong></span>
              <span><small>Service</small><strong>{selected.serviceName}</strong></span>
              <span><small>Barber</small><strong>{selected.barberName}</strong></span>
              <span><small>Service price</small><strong>{money(selected.servicePrice)}</strong></span>
              <span className="payment-summary__total"><small>Total</small><strong>{money(selected.total)}</strong></span>
            </div>
            <SelectField label="Payment method" value={method} disabled={processing} onChange={(event) => { setMethod(event.target.value as PaymentMethod); setCheckoutError(""); }}>
              {methods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </SelectField>
            {method === "cash" && <>
              <TextField label="Amount received" type="number" min="0" step="0.01" value={cashReceived} disabled={processing} onChange={(event) => setCashReceived(event.target.value)} required />
              {cashReceived && !cashValid && <p role="alert">Enter a valid cash amount with at most two decimal places.</p>}
              {cashValid && !sufficient && <p role="alert">Cash received is below the total.</p>}
              <p>Change: <strong>{change === null ? "—" : money(change)}</strong></p>
            </>}
            {checkoutError && <p role="alert">{checkoutError}</p>}
            <Button type="button" size="lg" variant="success" icon="check" className="payment-submit" disabled={processing || (method === "cash" && !sufficient)} onClick={() => void checkout()}>{processing ? "Processing…" : "Complete payment"}</Button>
          </>}
        </>}
      </Panel>
      <Panel className="recent-transactions-panel">
        <SectionHeading title="Transaction history" />
        <form className="transaction-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput); }}>
          <TextField label="Reference or customer" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <Button type="submit">Search</Button>
          <SelectField label="Payment method" value={methodFilter} onChange={(event) => { setPage(1); setMethodFilter(event.target.value); }}><option value="">All methods</option>{methods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField>
          <TextField label="From date" type="date" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.target.value); }} />
          <TextField label="To date" type="date" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.target.value); }} />
        </form>
        {!loading && !history.length && <EmptyState title="No transactions found" description="Try another search or date range." />}
        <div className="transaction-list">{history.map((transaction) => <div className="transaction-row" key={transaction.id}>
          <span><strong>{transaction.customerName}</strong><small>{transaction.serviceName} · {transaction.barberName} · {methodLabel(transaction.paymentMethod)}</small><small>{transaction.reference}</small></span>
          <span><strong>{money(transaction.total)}</strong><small>Status: {transaction.paymentStatus}</small><small>{new Date(transaction.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</small><Button type="button" variant="ghost" onClick={() => void openReceipt(transaction.reference)}>View receipt</Button></span>
        </div>)}</div>
        <div className="transaction-pages"><span>{total} transactions · Page {page} of {Math.max(1, totalPages)}</span><Button type="button" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button type="button" variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>Next</Button></div>
      </Panel>
    </div>
    {completed && <Panel><SectionHeading title="Payment completed" /><p>Reference: <strong>{completed.reference}</strong></p><p>{completed.customerName} · {completed.serviceName} · {completed.barberName}</p><p>Service price: {money(completed.subtotal)} · Total: {money(completed.total)} · {methodLabel(completed.paymentMethod)}</p>{completed.paymentMethod === "cash" && <p>Received: {money(completed.amountReceived ?? 0)} · Change: {money(completed.change ?? 0)}</p>}<Button type="button" onClick={() => void openReceipt(completed.reference, true)}>Print Receipt</Button></Panel>}
    {receiptLoading && <p>Loading receipt…</p>}
    {receiptError && <p role="alert">{receiptError}</p>}
    {receipt && <><Receipt transaction={receipt} onClose={() => setReceipt(null)} />
      {canManageFinancialActions && receipt.status === "completed" && <Panel className="financial-action-panel"><SectionHeading title="Refund or void transaction" />
        <p>Full amount: {money(receipt.total)}. A reason is required and the original receipt is retained.</p>
        <TextField label="Reason" value={actionReason} maxLength={500} onChange={(event) => setActionReason(event.target.value)} />
        {actionError && <p role="alert">{actionError}</p>}
        <Button type="button" disabled={actionProcessing || !actionReason.trim()} onClick={() => void applyAction("refund")}>Refund full amount</Button>
        <Button type="button" disabled={actionProcessing || !actionReason.trim()} onClick={() => void applyAction("void")}>Void transaction</Button>
      </Panel>}
      <Panel className="financial-audit-panel"><SectionHeading title="Financial audit history" />
        {!receipt.actions?.length && <p>No refund or void actions recorded.</p>}
        {receipt.actions?.map((action) => <p key={action.id}>{action.action} · {money(action.amount)} · {action.reason} · {action.staffName} · {new Date(action.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>)}
      </Panel></>}
  </>;
}
