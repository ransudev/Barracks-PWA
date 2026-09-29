import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { EligibleVisit, TransactionRecord } from "@/server/services/payment.service";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PaymentPage } = await import("@/app/pages/staff/PaymentPage");

const booking: EligibleVisit = { visitType: "booking", visitRecordId: 11, customerName: "Ava Client", serviceName: "Original cut", barberName: "Bea Barber", servicePrice: 425, total: 425 };
const walkIn: EligibleVisit = { visitType: "queue", visitRecordId: 12, customerName: "Will Walkin", serviceName: "Basic cut", barberName: "Bea Barber", servicePrice: 300, total: 300 };
const paid: TransactionRecord = { id: 1, reference: "TX-TEST", visitType: "booking", visitRecordId: 11, bookingId: 11, queueEntryId: null,
  customerId: 2, barberId: 3, serviceId: "cut", processedBy: 4, customerName: "Ava Client", barberName: "Bea Barber", cashierName: "Pat Cashier",
  serviceName: "Original cut", amount: 425, subtotal: 425, total: 425, paymentMethod: "cash", amountReceived: 500, change: 75,
  status: "completed", paymentStatus: "completed", createdAt: "2026-09-29T04:00:00Z" };

async function renderPayment() {
  const previousFetch = globalThis.fetch;
  let visits = [booking, walkIn];
  let history: TransactionRecord[] = [];
  const posts: Record<string, unknown>[] = [];
  const requests: string[] = [];
  let postResponse: Response | null = null;
  let releasePost: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/transactions?view=eligible") return Response.json({ success: true, visits });
    if (path === "/api/transactions?view=history") return Response.json({ success: true, transactions: history });
    if (path === "/api/transactions" && init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      if (postResponse) return postResponse;
      return new Promise<Response>((resolve) => { releasePost = resolve; });
    }
    throw new Error(`Unexpected request ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<PaymentPage onToast={() => undefined} />); });
  return { container, posts, requests, setVisits: (next: EligibleVisit[]) => { visits = next; },
    setHistory: (next: TransactionRecord[]) => { history = next; },
    setPostResponse: (response: Response) => { postResponse = response; },
    releasePost: (response: Response) => releasePost?.(response),
    cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
}

async function choose(container: HTMLElement, value: string) {
  const select = container.querySelectorAll('select')[0] as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
}
async function setMethod(container: HTMLElement, value: string) {
  const select = container.querySelectorAll('select')[1] as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
}
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}
const submit = (container: HTMLElement) => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Complete payment"))!;

test("cash checkout requires sufficient received amount, submits once, and refreshes server history", async () => {
  const page = await renderPayment();
  try {
    await choose(page.container, "booking:11");
    assert.match(page.container.textContent ?? "", /Ava Client.*Original cut.*Bea Barber[\s\S]*₱425/);
    assert.equal(submit(page.container).disabled, true);
    const input = page.container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => { setInputValue(input, "400"); });
    assert.equal(submit(page.container).disabled, true);
    await act(async () => { setInputValue(input, "500"); });
    assert.match(page.container.textContent ?? "", /Change: ₱75/);
    await act(async () => { submit(page.container).click(); submit(page.container).click(); });
    assert.equal(page.posts.length, 1);
    assert.deepEqual(page.posts[0], { visit: { bookingId: 11 }, paymentMethod: "cash", amountReceived: 500 });
    assert.equal(page.container.textContent?.includes("Processing…"), true);
    page.setVisits([walkIn]); page.setHistory([paid]);
    await act(async () => { page.releasePost(Response.json({ success: true, transaction: paid }, { status: 201 })); });
    assert.match(page.container.textContent ?? "", /Payment completed.*TX-TEST[\s\S]*Received: ₱500[\s\S]*Change: ₱75/);
    assert.equal(page.container.querySelectorAll('.transaction-row').length, 1);
    assert.equal(page.requests.filter((request) => request === "GET /api/transactions?view=eligible").length, 2);
  } finally { await page.cleanup(); }
});

test("non-cash checkout omits cash fields and shows duplicate conflict", async () => {
  const page = await renderPayment();
  try {
    await choose(page.container, "queue:12");
    await setMethod(page.container, "e_wallet");
    assert.equal(page.container.querySelector('input[type="number"]'), null);
    page.setPostResponse(Response.json({ success: false, message: "A transaction already exists for this visit" }, { status: 409 }));
    await act(async () => { submit(page.container).click(); });
    assert.deepEqual(page.posts[0], { visit: { queueEntryId: 12 }, paymentMethod: "e_wallet" });
    assert.match(page.container.textContent ?? "", /A transaction already exists for this visit/);
    assert.equal(page.requests.filter((request) => request === "GET /api/transactions?view=eligible").length, 2);
  } finally { await page.cleanup(); }
});
