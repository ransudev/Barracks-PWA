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

const manager: ApiUser = { id: 1, firstName: "Mae", lastName: "Manager", email: "mae@example.test", role: "manager", isVerified: true, isBlocked: false, isActive: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" };
const supplier = { id: 7, companyName: "Supplies Co", contactPerson: "Sam", phone: "09123456789", email: "", address: "", notes: "", status: "active", hasAccount: false, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" };

for (const role of ["manager", "administrator"] as const) {
  test(`${role} supplier controls match API permissions`, async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const path = String(input);
      if (path === "/api/suppliers") return Response.json({ success: true, suppliers: [supplier] });
      if (path === "/api/suppliers/7") return Response.json({ success: true, profile: { supplier, suppliedItems: [], recentDeliveries: [], restockHistory: [] } });
      throw new Error(`Unexpected request ${path}`);
    };
    const container = dom.window.document.createElement("div");
    dom.window.document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => { root.render(<PageRouter view="admin-suppliers" go={() => undefined} onToast={() => undefined} currentUser={{ ...manager, role }} />); });
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
      await act(async () => {
        (container.querySelector('button[aria-label="Open Supplies Co"]') as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 60));
      });
      assert.match(dom.window.document.body.textContent ?? "", /Edit profile/);
      assert.equal(Boolean(Array.from(dom.window.document.body.querySelectorAll("button")).find((button) => button.textContent === "Deactivate")), role === "administrator");
      assert.equal(Boolean(Array.from(dom.window.document.body.querySelectorAll("button")).find((button) => button.textContent === "Create login")), role === "administrator");
      await act(async () => {
        (Array.from(dom.window.document.body.querySelectorAll("button")).find((button) => button.textContent === "Edit profile") as HTMLButtonElement).click();
      });
      assert.equal((dom.window.document.body.querySelector(".operational-drawer-layer select") as HTMLSelectElement).disabled, role === "manager");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      globalThis.fetch = previousFetch;
    }
  });
}
