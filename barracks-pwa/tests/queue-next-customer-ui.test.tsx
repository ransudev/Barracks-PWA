import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { QueuePage } from "@/app/pages/staff/QueuePage";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const waiting = { id: 7, bookingId: null, customerId: 3, customerName: "Next Customer", serviceId: "cut",
  serviceName: "Basic Cut", barberId: null, barberName: null, status: "waiting", joinedAt: "2026-09-27T02:00:00Z",
  startedAt: null, completedAt: null, createdAt: "2026-09-27T02:00:00Z", updatedAt: "2026-09-27T02:00:00Z" };

async function renderQueue(candidate: typeof waiting | null) {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/queue") return Response.json({ success: true, queue: candidate ? [waiting] : [] });
    if (path === "/api/customers") return Response.json({ success: true, customers: [{ id: 3, firstName: "Next", lastName: "Customer" }] });
    if (path === "/api/services") return Response.json({ success: true, services: [{ id: "cut", name: "Basic Cut", active: true, durationMinutes: 45 }] });
    if (path === "/api/barbers") return Response.json({ success: true, barbers: [{ id: 1, firstName: "Test", lastName: "Barber", status: "available" }] });
    if (path === "/api/queue/next?barberId=1") return Response.json({ success: true, entry: candidate, message: candidate ? null : "No eligible customer is waiting for this barber." });
    if (path === "/api/queue/next" && init?.method === "POST") return Response.json({ success: true, entry: { ...waiting, status: "ready", barberId: 1, barberName: "Test Barber" } });
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<QueuePage onToast={() => undefined} />); });
    return { container, requests, cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
  } catch (error) {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch;
    throw error;
  }
}

async function selectBarberAndSuggest(container: HTMLElement) {
  const select = container.querySelector<HTMLSelectElement>(".queue-next__controls select")!;
  await act(async () => { select.value = "1"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>(".queue-next__controls button"))[0];
  await act(async () => { button.click(); });
}

test("front desk reviews and confirms assignment without starting service", async () => {
  const view = await renderQueue(waiting);
  try {
    await selectBarberAndSuggest(view.container);
    const summary = view.container.querySelector(".queue-next__suggestion")?.textContent ?? "";
    for (const detail of ["Next Customer", "Basic Cut", "Walk-in", "Unassigned"]) assert.ok(summary.includes(detail));
    assert.equal(view.requests.some((request) => request.startsWith("POST ")), false, "suggestion is read-only");
    const assign = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".queue-next__suggestion button")).find((button) => button.textContent?.includes("Assign barber"))!;
    await act(async () => { assign.click(); });
    assert.ok(view.requests.includes("POST /api/queue/next"));
    assert.equal(view.requests.some((request) => request.includes("/api/queue/7")), false, "service start is a separate action");
    assert.match(view.container.querySelector(".queue-next__suggestion")?.textContent ?? "", /Test Barber/);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.match(view.container.textContent ?? "", /Start Service/);
  } finally { await view.cleanup(); }
});

test("front desk sees a clear empty suggestion", async () => {
  const view = await renderQueue(null);
  try {
    await selectBarberAndSuggest(view.container);
    assert.match(view.container.querySelector(".queue-next__message")?.textContent ?? "", /No eligible customer is waiting/);
    assert.equal(view.container.querySelector(".queue-next__suggestion"), null);
  } finally { await view.cleanup(); }
});
