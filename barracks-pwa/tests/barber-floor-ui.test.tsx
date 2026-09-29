import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { ApiUser } from "@/app/lib/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { PageRouter } = await import("@/app/pages/PageRouter");

const frontDesk: ApiUser = { id: 1, firstName: "Fran", lastName: "Desk", email: "fran@example.test", role: "front_desk", isVerified: true, isBlocked: false, isActive: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" };

test("Front Desk barber route renders only operational floor data", async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/barbers") return Response.json({ success: true, barbers: [
      { id: 3, firstName: "Bea", lastName: "Barber", status: "available" },
      { id: 4, firstName: "Cal", lastName: "Cutter", status: "unavailable" },
    ] });
    if (path === "/api/queue?view=active") return Response.json({ success: true, queue: [
      { id: 8, barberId: 3, customerName: "Ava Client", serviceName: "Original cut", status: "in_progress" },
    ] });
    throw new Error(`Unexpected request ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<PageRouter view="barbers" go={() => undefined} onToast={() => undefined} currentUser={frontDesk} />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    const content = container.textContent ?? "";
    assert.match(content, /Barber Floor/);
    assert.match(content, /Bea Barber/);
    assert.match(content, /In service/);
    assert.match(content, /Ava Client · Original cut/);
    for (const forbidden of ["Commission", "Revenue", "Rating", "Add barber", "Edit profile", "Shop hours", "Schedule", "Absences", "Set commission rate"]) {
      assert.equal(content.includes(forbidden), false, forbidden);
    }
    assert.deepEqual(requests.sort(), ["GET /api/barbers", "GET /api/queue?view=active"].sort());
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = previousFetch;
  }
});

async function renderManagementBarbers(role: "manager" | "administrator") {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = String(input);
    if (path === "/api/barbers") return Response.json({ success: true, barbers: [
      { id: 3, firstName: "Bea", lastName: "Barber", status: "available", commissionRate: 20, servicesDone: 4, revenue: 1200, rating: 4.5, scheduleDayCount: 7, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" },
    ] });
    if (path === "/api/shop-hours") return Response.json({ hours: [] });
    throw new Error(`Unexpected request ${path}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<PageRouter view="admin-barbers" go={() => undefined} onToast={() => undefined} currentUser={{ ...frontDesk, role }} />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
}

test("Manager keeps Barber Management but Administrator-only destructive controls stay hidden", async () => {
  const page = await renderManagementBarbers("manager");
  try {
    assert.match(page.container.textContent ?? "", /Barber management/);
    assert.match(page.container.textContent ?? "", /Shop hours and barber schedules/);
    assert.equal(page.container.textContent?.includes("Set commission rate"), false);
    await act(async () => { (page.container.querySelector('button[aria-label="Open Bea Barber"]') as HTMLButtonElement).click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.equal(page.container.textContent?.includes("Remove barber"), false);
  } finally { await page.cleanup(); }
});

test("Administrator keeps bulk commission and barber deletion controls", async () => {
  const page = await renderManagementBarbers("administrator");
  try {
    assert.match(page.container.textContent ?? "", /Set commission rate/);
    await act(async () => { (page.container.querySelector('button[aria-label="Open Bea Barber"]') as HTMLButtonElement).click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.match(page.container.textContent ?? "", /Remove barber/);
  } finally { await page.cleanup(); }
});
