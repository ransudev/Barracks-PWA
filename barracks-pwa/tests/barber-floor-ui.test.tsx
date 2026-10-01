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

test("Front Desk barber floor shows operational data and changes status through the narrow endpoint", async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    requests.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/branch-context") return Response.json({ branches: [{ id: 1, name: "Main Branch", status: "active" }, { id: 2, name: "Second Branch", status: "active" }], primaryBranch: { id: 1 } });
    if (path === "/api/barbers?branchId=1") return Response.json({ success: true, barbers: [
      { id: 3, firstName: "Bea", lastName: "Barber", status: "available" },
      { id: 4, firstName: "Cal", lastName: "Cutter", status: "unavailable" },
    ] });
    if (path === "/api/barbers?branchId=2") return Response.json({ success: true, barbers: [{ id: 9, firstName: "Second", lastName: "Barber", status: "available" }] });
    if (path === "/api/queue?view=active&branchId=2") return Response.json({ success: true, queue: [] });
    if (path === "/api/queue?view=active&branchId=1") return Response.json({ success: true, queue: [
      { id: 8, barberId: 3, customerName: "Ava Client", serviceName: "Original cut", status: "in_progress" },
    ] });
    if (path === "/api/attendance/today") return Response.json({ success: true, attendance: [] });
    if (path === "/api/attendance/today/4" && init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), { action: "mark", status: "present" });
      return Response.json({ success: true, attendance: { id: 2, barberId: 4, barberName: "Cal Cutter", date: "2026-09-29", status: "present", clockIn: null, clockOut: null } });
    }
    if (path === "/api/barbers/4/status" && init?.method === "PATCH") {
      assert.deepEqual(JSON.parse(String(init.body)), { status: "available" });
      return Response.json({ success: true, barber: { id: 4, firstName: "Cal", lastName: "Cutter", status: "available" } });
    }
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
    assert.deepEqual(requests.sort(), ["GET /api/branch-context", "GET /api/barbers?branchId=1", "GET /api/queue?view=active&branchId=1", "GET /api/attendance/today"].sort());
    const statusSelect = container.querySelector('select[aria-label="Operational status for Cal Cutter"]') as HTMLSelectElement;
    assert.ok(statusSelect);
    await act(async () => {
      statusSelect.value = "available";
      statusSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(requests.includes("PATCH /api/barbers/4/status"));
    assert.match(container.textContent ?? "", /Attendance today/);
    await act(async () => {
      const card = Array.from(container.querySelectorAll(".barber-status-card")).find((item) => item.textContent?.includes("Cal Cutter"))!;
      (Array.from(card.querySelectorAll("button")).find((button) => button.textContent?.includes("Mark present")) as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.ok(requests.includes("POST /api/attendance/today/4"));
    const branchSelect = container.querySelector('select') as HTMLSelectElement;
    await act(async () => { branchSelect.value = "2"; branchSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    assert.match(container.textContent ?? "", /Second Barber/);
    assert.equal(container.textContent?.includes("Bea Barber"), false);
    assert.equal(container.textContent?.includes("Cal Cutter"), false);
    assert.ok(requests.includes("GET /api/barbers?branchId=2"));
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
    if (path === "/api/branch-context") return Response.json({ branches: [{ id: 1, name: "Main Branch", status: "active" }, { id: 2, name: "Second Branch", status: "active" }], primaryBranch: { id: 1 } });
    if (path === "/api/barbers?branchId=1") return Response.json({ success: true, barbers: [
      { id: 3, firstName: "Bea", lastName: "Barber", status: "available", commissionRate: 20, servicesDone: 4, revenue: 1200, rating: 4.5, scheduleDayCount: 7, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" },
    ] });
    if (path === "/api/barbers?branchId=2") return Response.json({ success: true, barbers: [{ id: 9, branchId: 2, firstName: "Second", lastName: "Barber", status: "available", commissionRate: null, servicesDone: 0, revenue: 0, rating: null, scheduleDayCount: 7 }] });
    if (path === "/api/shop-hours?branchId=2") return Response.json({ hours: [{ dayOfWeek: 1, openTime: "12:00", closeTime: "16:00", isClosed: false }] });
    if (path === "/api/shop-hours?branchId=1") return Response.json({ hours: [] });
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

for (const role of ["manager", "administrator"] as const) {
  test(`${role} branch selection reloads the roster and branch hours together`, async () => {
    const page = await renderManagementBarbers(role);
    try {
      const selector = page.container.querySelector("select") as HTMLSelectElement;
      await act(async () => { selector.value = "2"; selector.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
      assert.match(page.container.textContent ?? "", /Second Barber/);
      assert.equal(page.container.textContent?.includes("Bea Barber"), false);
      assert.equal((page.container.querySelector('input[type="time"]') as HTMLInputElement).value, "12:00");
      const barberSelector = page.container.querySelector('.schedule-management__barber-select select') as HTMLSelectElement;
      assert.match(barberSelector?.textContent ?? "", /Second Barber/);
      assert.equal(barberSelector?.textContent?.includes("Bea Barber"), false);
    } finally { await page.cleanup(); }
  });
}
