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

const user: ApiUser = { id: 1, firstName: "Mae", lastName: "Manager", email: "mae@example.test", role: "manager", isVerified: true, isBlocked: false, isActive: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" };

for (const role of ["manager", "administrator"] as const) {
  test(`${role} can see attendance history, details, and correction audit`, async () => {
    const previousFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input, init) => {
      const path = String(input);
      requests.push(`${init?.method ?? "GET"} ${path}`);
      if (path.startsWith("/api/attendance/history")) return Response.json({ success: true, attendance: [{ id: 5, barberId: 3, barberName: "Bea Barber", date: "2026-09-29", status: "late", clockIn: null, clockOut: null, recordedBy: 2, updatedBy: 2, createdAt: "2026-09-29T01:00:00Z", updatedAt: "2026-09-29T01:00:00Z" }] });
      if (path === "/api/barbers") return Response.json({ success: true, barbers: [{ id: 3, firstName: "Bea", lastName: "Barber", status: "available" }] });
      if (path === "/api/attendance/5/corrections") return Response.json({ success: true, corrections: [{ id: 1, reason: "Reviewed shift", correctedByName: "Mae Manager", createdAt: "2026-09-29T02:00:00Z", previousValues: { status: "present", clockIn: null, clockOut: null }, newValues: { status: "late", clockIn: null, clockOut: null } }] });
      throw new Error(`Unexpected request ${path}`);
    };
    const container = dom.window.document.createElement("div");
    dom.window.document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<PageRouter view="admin-attendance" go={() => undefined} onToast={() => undefined} currentUser={{ ...user, role }} />); });
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
      assert.match(container.textContent ?? "", /Barber attendance/);
      assert.match(container.textContent ?? "", /Bea Barber/);
      assert.ok(requests.some((request) => request.startsWith("GET /api/attendance/history?date=")));
      await act(async () => {
        (Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("View record")) as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      assert.match(container.textContent ?? "", /Reviewed shift/);
      assert.match(container.textContent ?? "", /Correction reason/);
      assert.ok(requests.includes("GET /api/attendance/5/corrections"));
    } finally {
      await act(async () => root.unmount());
      container.remove();
      globalThis.fetch = previousFetch;
    }
  });
}
