import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { ApiQueueEntry } from "@/app/lib/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueuePage } = await import("@/app/pages/staff/QueuePage");

const waiting = { id: 7, bookingId: null, customerId: 3, customerName: "Next Customer", serviceId: "cut",
  serviceName: "Basic Cut", barberId: null, barberName: null, status: "waiting", joinedAt: "2026-09-27T02:00:00Z",
  startedAt: null, completedAt: null, createdAt: "2026-09-27T02:00:00Z", updatedAt: "2026-09-27T02:00:00Z" };

async function renderQueue(candidate: typeof waiting | null, holdQueuePost = false, completed: ApiQueueEntry[] = []) {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  const postedBodies: Record<string, unknown>[] = [];
  let releaseQueuePost: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/queue?view=active") return Response.json({ success: true, queue: candidate ? [waiting] : [] });
    if (path === "/api/queue?view=completed-today") return Response.json({ success: true, queue: completed });
    if (path === "/api/customers") return Response.json({ success: true, customers: [{ id: 3, userId: 8, firstName: "Next", lastName: "Customer", email: "next@test.local", phone: "", preferredBarberId: null, preferredBarberName: null, loyaltyPoints: 0, createdAt: "2026-09-27T02:00:00Z", updatedAt: "2026-09-27T02:00:00Z" }] });
    if (path === "/api/services") return Response.json({ success: true, services: [{ id: "cut", name: "Basic Cut", active: true, durationMinutes: 45 }] });
    if (path === "/api/barbers") return Response.json({ success: true, barbers: [{ id: 1, firstName: "Test", lastName: "Barber", status: "available" }] });
    if (path === "/api/queue/next?barberId=1") return Response.json({ success: true, entry: candidate, message: candidate ? null : "No eligible customer is waiting for this barber." });
    if (path === "/api/queue/next" && init?.method === "POST") return Response.json({ success: true, entry: { ...waiting, status: "ready", barberId: 1, barberName: "Test Barber" } });
    if (path === "/api/queue" && init?.method === "POST") {
      const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
      postedBodies.push(payload);
      const newCustomer = payload.customer as { firstName: string; lastName: string } | undefined;
      const name = newCustomer ? `${newCustomer.firstName} ${newCustomer.lastName}` : "Next Customer";
      const entry = { ...waiting, id: 8, customerId: newCustomer ? 4 : 3, customerName: name, status: payload.barberId ? "ready" : "waiting", barberId: payload.barberId ?? null, barberName: payload.barberId ? "Test Barber" : null };
      const response = Response.json({ success: true, entry });
      if (holdQueuePost) return await new Promise<Response>((resolve) => { releaseQueuePost = resolve; });
      return response;
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<QueuePage onToast={() => undefined} />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    return { container, requests, postedBodies, releaseQueuePost: (response: Response) => releaseQueuePost?.(response), cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
  } catch (error) {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch;
    throw error;
  }
}

test("completed-today entries show service details without active actions", async () => {
  const finished: ApiQueueEntry = { ...waiting, id: 9, customerName: "Finished Customer", status: "completed",
    barberId: 1, barberName: "Test Barber", startedAt: "2026-09-27T02:00:00Z", completedAt: "2026-09-27T02:30:00Z" };
  const view = await renderQueue(waiting, false, [finished]);
  try {
    assert.equal(view.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent, "Active");
    const tab = Array.from(view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((button) => button.textContent === "Completed Today")!;
    await act(async () => { tab.click(); });
    assert.ok(view.requests.includes("GET /api/queue?view=completed-today"));
    const panel = view.container.querySelector('[role="tabpanel"]')!;
    for (const detail of ["Finished Customer", "Basic Cut", "Test Barber", "Walk-in", "Sep", "10:00", "10:30"])
      assert.ok(panel.textContent?.includes(detail), detail);
    assert.equal(view.container.querySelector(".queue-next-panel"), null);
    assert.equal(view.container.querySelector(".operational-drawer__actions"), null);
    assert.equal(panel.querySelectorAll("button").length, 0);
  } finally { await view.cleanup(); }
});

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

test("front desk creates a walk-in customer and queues them without leaving the Queue page", async () => {
  const view = await renderQueue(null);
  try {
    const addButton = Array.from(view.container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add to queue")!;
    await act(async () => { addButton.click(); });
    const form = view.container.querySelector<HTMLFormElement>(".modal-form")!;
    const selects = form.querySelectorAll<HTMLSelectElement>("select");
    await act(async () => {
      selects[0].value = "new";
      selects[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    const fields = form.querySelectorAll<HTMLInputElement>("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set?.call(fields[0], "Walk");
      fields[0].dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      fields[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set?.call(fields[1], "In");
      fields[1].dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      fields[1].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      selects[2].value = "1";
      selects[2].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    const submit = Array.from(form.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.type === "submit")!;
    await act(async () => { submit.click(); });
    assert.equal(view.postedBodies.length, 1);
    assert.deepEqual(view.postedBodies[0].customer, { firstName: "Walk", lastName: "In", phone: "" });
    assert.equal(view.postedBodies[0].serviceId, "cut");
    assert.equal(view.postedBodies[0].barberId, 1);
    assert.equal(typeof view.postedBodies[0].idempotencyKey, "string");
    assert.equal("email" in view.postedBodies[0], false);
    assert.equal("password" in view.postedBodies[0], false);
    assert.match(view.container.textContent ?? "", /Walk In/);
    assert.match(view.container.textContent ?? "", /Ready/);
  } finally { await view.cleanup(); }
});

test("Queue form blocks a rapid duplicate submission while the first request is pending", async () => {
  const view = await renderQueue(null, true);
  try {
    const addButton = Array.from(view.container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add to queue")!;
    await act(async () => { addButton.click(); });
    const form = view.container.querySelector<HTMLFormElement>(".modal-form")!;
    const submit = Array.from(form.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.type === "submit")!;
    await act(async () => { submit.click(); submit.click(); });
    assert.equal(view.postedBodies.length, 1);
    const payload = view.postedBodies[0];
    const body = payload.customerId ? waiting : { ...waiting, id: 8 };
    view.releaseQueuePost(Response.json({ success: true, entry: body }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  } finally { await view.cleanup(); }
});
