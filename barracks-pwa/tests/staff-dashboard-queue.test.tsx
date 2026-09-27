import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { StaffDashboard } from "@/app/pages/staff/StaffDashboard";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (id: number, status: string) => ({ id, bookingId: id === 1 ? 100 : null, customerId: id,
  customerName: `Queue Customer ${id}`, serviceId: "cut", serviceName: "Cut", barberId: 1,
  barberName: "Test Barber", status, joinedAt: "2026-09-25T00:00:00Z", startedAt: null,
  completedAt: null, createdAt: "2026-09-25T00:00:00Z", updatedAt: "2026-09-25T00:00:00Z" });

async function renderDashboard(queueResponse: Response) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = String(input);
    if (path === "/api/queue?view=active") return queueResponse;
    if (path === "/api/barbers") return Response.json({ success: true, barbers: [] });
    if (path === "/api/bookings") return Response.json({ success: true, bookings: [] });
    if (path === "/api/inventory") return Response.json({ success: true, items: [] });
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<StaffDashboard go={() => undefined} onToast={() => undefined} />); });
    return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
  } catch (error) {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = previousFetch;
    throw error;
  }
}

test("staff dashboard counts active persisted queue entries and previews them", async () => {
  const view = await renderDashboard(Response.json({ success: true, queue: [entry(1, "ready"), entry(2, "waiting"), entry(3, "completed"), entry(4, "removed")] }));
  try {
    assert.match(view.container.querySelector(".metrics-grid")?.textContent ?? "", /Customers in queue\s*2/);
    assert.equal(view.container.querySelectorAll(".queue-preview__row").length, 2);
    assert.match(view.container.textContent ?? "", /Queue Customer 1/);
  } finally { await view.cleanup(); }
});

test("staff dashboard distinguishes empty and failed queue loads", async () => {
  const empty = await renderDashboard(Response.json({ success: true, queue: [] }));
  try { assert.match(empty.container.querySelector(".queue-preview")?.textContent ?? "", /No customers in queue/); }
  finally { await empty.cleanup(); }
  const failed = await renderDashboard(Response.json({ success: false, message: "Queue unavailable" }, { status: 500 }));
  try {
    assert.match(failed.container.querySelector(".queue-preview")?.textContent ?? "", /Queue unavailable/);
    assert.match(failed.container.querySelector(".metrics-grid")?.textContent ?? "", /Unable to load queue/);
  } finally { await failed.cleanup(); }
});
