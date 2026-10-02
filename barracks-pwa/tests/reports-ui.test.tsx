import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { summarizeRevenueEvents } from "@/server/services/revenue-report.service";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, { document: dom.window.document, window: dom.window, IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ManagementReports } = await import("@/app/pages/admin/ManagementReports");
const pause = () => new Promise((resolve) => setTimeout(resolve, 20));

test("report branch switches replace global data, reset filters and ignore a delayed old response", async () => {
  const previous = globalThis.fetch;
  let release: (response: Response) => void = () => { throw new Error("Old branch was not requested"); };
  const requests: string[] = [], toasts: string[] = [];
  const report = (label: string, amount: string) => Response.json({ success: true, ...summarizeRevenueEvents({ from: "2026-09-02", to: "2026-09-03" }, [
    { day: "2026-09-02", service_name: label, barber_name: label, payment_method: "cash", event_type: "sale", amount, transaction_count: "1" },
  ]) });
  globalThis.fetch = async (input) => {
    const path = String(input); requests.push(path);
    if (path === "/api/branch-context") return Response.json({ branches: [{ id: 1, name: "Main Branch", status: "active" }, { id: 2, name: "Second Branch", status: "active" }], primaryBranch: { id: 1 } });
    const branch = new URL(path, "http://localhost").searchParams.get("branchId");
    if (path.startsWith("/api/reports/revenue")) {
      if (branch === "all") return report("Global sales", "400");
      if (branch === "1") return new Promise<Response>((resolve) => { release = resolve; });
      if (branch === "2") return report("Second sales", "300");
    }
    if (path.startsWith("/api/reports/inventory") && branch === "2") return Response.json({ success: true, valuation: { totalValue: 50, activeItems: 1, lowStockItems: 0 }, supplierSpending: [], usageSummary: [], movements: [] });
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const changeBranch = async (value: string) => {
    await act(async () => { const selector = container.querySelector("select")!; selector.value = value; selector.dispatchEvent(new dom.window.Event("change", { bubbles: true })); await pause(); });
  };
  try {
    await act(async () => { root.render(<ManagementReports globalAllowed onToast={(message) => toasts.push(message)} />); await pause(); });
    await act(pause);
    assert.match(container.textContent ?? "", /Global view · All branches/);
    assert.match(container.textContent ?? "", /Global sales/);
    const from = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    const originalDate = from.value;
    // Change an unapplied draft; selecting a branch must reset it.
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(from, "2020-01-01");
      from.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(from.value, "2020-01-01");
    await changeBranch("1");
    assert.doesNotMatch(container.textContent ?? "", /Global sales/);
    await changeBranch("2");
    assert.match(container.textContent ?? "", /Branch view · Second Branch/);
    assert.match(container.textContent ?? "", /Second sales/);
    assert.equal(container.querySelector<HTMLInputElement>('input[type="date"]')?.value, originalDate);
    await act(async () => { release(report("Stale Main sales", "100")); await pause(); });
    assert.doesNotMatch(container.textContent ?? "", /Stale Main sales|Global sales/);
    assert.match(container.textContent ?? "", /Second sales/);
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Inventory reports")!.click(); await pause(); });
    assert.ok(requests.some((path) => path.startsWith("/api/reports/inventory") && path.endsWith("branchId=2")));
    assert.deepEqual(toasts, []);
  } finally { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previous; }
});
