import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { JSDOM } from "jsdom";
import type { ApiUser } from "@/app/lib/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
mock.module("@/app/pages/customer/CustomerTopbar", { namedExports: { CustomerTopbar: () => null } });
const { CustomerBookingPage } = await import("@/app/pages/customer/CustomerBookingPage");
const user: ApiUser = { id: 10, firstName: "Ana", lastName: "Test", email: "ana@test.local", role: "customer", isActive: true, isBlocked: false, isVerified: true, createdAt: "", updatedAt: "" };
const field = (name: string) => {
  const label = [...document.querySelectorAll("label")].find((item) => item.textContent?.startsWith(name));
  const input = label?.querySelector("select,input") as HTMLInputElement | HTMLSelectElement | undefined;
  assert.ok(input, `Missing ${name}`); return input;
};
async function change(name: string, value: string) {
  await act(async () => {
    const input = field(name);
    const prototype = input.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}

test("switching customer branches clears barber/date/time and ignores stale availability; selection is remembered", async () => {
  const previous = globalThis.fetch;
  sessionStorage.clear();
  let resolveOld!: (response: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
  const requests: string[] = [];
  const branches = [{ id: 1, name: "Main Branch", code: "MAIN", address: "Main Road", phone: "1" }, { id: 2, name: "Branch A", code: "A", address: "A Road", phone: "2" }];
  globalThis.fetch = async (input) => {
    const path = String(input); requests.push(path);
    const url = new URL(path, "http://localhost"), branch = Number(url.searchParams.get("branchId"));
    if (url.pathname === "/api/customer-branches") return Response.json({ success: true, branches });
    if (url.pathname === "/api/barbers") return Response.json({ success: true, barbers: [{ id: branch * 11, firstName: branch === 1 ? "Main" : "A", lastName: "Barber", status: "available" }] });
    if (url.pathname === "/api/services") return Response.json({ success: true, services: [{ id: "cut", name: "Cut", price: 100, durationMinutes: 30, active: true }] });
    if (url.pathname === "/api/shop-hours") return Response.json({ success: true, hours: [{ dayOfWeek: 1, openTime: branch === 1 ? "09:00" : "12:00", closeTime: "16:00", isClosed: false }] });
    if (url.pathname === "/api/bookings/availability") {
      if (branch === 1 && !url.searchParams.has("barberId")) return oldResponse;
      return Response.json({ success: true, slots: [{ startTime: branch === 1 ? "10:00" : "12:00", endTime: branch === 1 ? "10:30" : "12:30" }] });
    }
    throw new Error(`Unexpected ${path}`);
  };
  const errors: string[] = [];
  const props = { user, go: () => undefined, onSignOut: () => undefined, onToast: (message: string) => errors.push(message) };
  const container = document.createElement("div"); document.body.append(container);
  let root = createRoot(container);
  try {
    await act(async () => root.render(<CustomerBookingPage {...props} />));
    assert.equal(field("Booking branch").value, "1", "new customers safely default to Main");
    await change("Date", "2099-10-05");
    await change("Barber", "11");
    await change("Available time", "10:00");
    assert.equal(field("Barber").value, "11");
    assert.equal(field("Available time").value, "10:00");
    await change("Booking branch", "2");
    assert.equal(field("Barber").value, "");
    assert.equal(field("Date").value, "");
    assert.equal(field("Available time").value, "");
    assert.equal(field("Available time").querySelectorAll("option").length, 1);
    assert.equal(field("Barber").querySelector('option[value="11"]'), null);
    await act(async () => resolveOld(Response.json({ success: true, slots: [{ startTime: "08:00", endTime: "08:30" }] })));
    assert.equal(field("Available time").querySelector('option[value="08:00"]'), null);
    await change("Date", "2099-10-05");
    assert.equal(field("Available time").querySelector('option[value="12:00"]')?.textContent, "12:00–12:30");
    assert.ok(requests.some((path) => path.startsWith("/api/bookings/availability?") && path.includes("branchId=2")));
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<CustomerBookingPage {...props} />));
    assert.equal(field("Booking branch").value, "2");
    assert.equal(field("Date").value, "");
    assert.deepEqual(errors, []);
  } finally { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previous; }
});
