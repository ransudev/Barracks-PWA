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

export function PaymentPage({ onToast }: { onToast: (message: string) => void }) {
  const [visits, setVisits] = useState<EligibleVisit[]>([]);
  const [history, setHistory] = useState<TransactionRecord[]>([]);
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
        apiRequest("/api/transactions?view=history", { cache: "no-store" }),
      ]);
      const [visitsBody, historyBody] = await Promise.all([
        readApiBody<{ success: boolean; visits?: EligibleVisit[]; message?: string }>(visitsResponse),
        readApiBody<{ success: boolean; transactions?: TransactionRecord[]; message?: string }>(historyResponse),
      ]);
      if (!visitsResponse.ok || !visitsBody?.success || !visitsBody.visits ||
          !historyResponse.ok || !historyBody?.success || !historyBody.transactions) {
        throw new Error(visitsBody?.message ?? historyBody?.message ?? "Unable to load payments");
      }
      if (version !== requestVersion.current) return;
      setVisits(visitsBody.visits);
      setHistory(historyBody.transactions);
      setSelectedKey((current) => visitsBody.visits!.some((visit) => visitKey(visit) === current) ? current : "");
      setLoadError("");
    } catch (error) {
      if (version === requestVersion.current) setLoadError(error instanceof Error ? error.message : "Unable to load payments");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

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
        <p>Most recent 100 transactions</p>
        {!loading && !history.length && <EmptyState title="No transactions yet" description="Completed payments will appear here." />}
        <div className="transaction-list">{history.map((transaction) => <div className="transaction-row" key={transaction.id}>
          <span><strong>{transaction.customerName}</strong><small>{transaction.serviceName} · {transaction.barberName} · {methodLabel(transaction.paymentMethod)}</small><small>{transaction.reference}</small></span>
          <span><strong>{money(transaction.total)}</strong><small>{new Date(transaction.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</small></span>
        </div>)}</div>
      </Panel>
    </div>
    {completed && <Panel><SectionHeading title="Payment completed" /><p>Reference: <strong>{completed.reference}</strong></p><p>{completed.customerName} · {completed.serviceName} · {completed.barberName}</p><p>Service price: {money(completed.subtotal)} · Total: {money(completed.total)} · {methodLabel(completed.paymentMethod)}</p>{completed.paymentMethod === "cash" && <p>Received: {money(completed.amountReceived ?? 0)} · Change: {money(completed.change ?? 0)}</p>}</Panel>}
  </>;
}
