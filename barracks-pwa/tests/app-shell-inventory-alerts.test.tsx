import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { JSDOM } from "jsdom";
import type { ApiUser } from "@/app/lib/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
mock.module("next/image", { defaultExport: () => null });
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { AppShell } = await import("@/app/components/layout/AppShell");
const { useBranchContext } = await import("@/app/utils/use-branch-context");

const user: ApiUser = { id: 4, firstName: "A", lastName: "Admin", email: "admin@test.local", role: "administrator", isVerified: true, isBlocked: false, isActive: true, createdAt: "", updatedAt: "" };
function BranchChoice() {
  const { setBranchId } = useBranchContext();
  return createElement("button", { type: "button", onClick: () => setBranchId(2) }, "Choose second branch");
}

const alert = (id: number, itemName: string) => ({ id, itemId: id, itemName, branch: id === 1 ? "Main" : "Second", currentQuantity: 0, threshold: 2, unit: "pcs" });

test("shell inventory notifications follow branch selection and discard the previous branch response", async () => {
  const previousFetch = globalThis.fetch;
  let resolveMain!: (response: Response) => void;
  const mainAlert = new Promise<Response>((resolve) => { resolveMain = resolve; });
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input);
    requested.push(path);
    if (path === "/api/branch-context") return Response.json({ branches: [
      { id: 1, name: "Main", code: "MAIN", address: "", phone: "", status: "active", createdAt: "", updatedAt: "" },
      { id: 2, name: "Second", code: "SECOND", address: "", phone: "", status: "active", createdAt: "", updatedAt: "" },
    ], primaryBranch: { id: 1, name: "Main", code: "MAIN", address: "", phone: "", status: "active", createdAt: "", updatedAt: "" } });
    if (path === "/api/inventory/alerts?branchId=1") return mainAlert;
    if (path === "/api/inventory/alerts?branchId=2") return Response.json({ success: true, alerts: [alert(2, "Second branch stock")] });
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(AppShell, { area: "admin", active: "admin-dashboard", go: () => undefined, onToast: () => undefined, currentUser: user, onSignOut: async () => undefined, children: createElement(BranchChoice) })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assert.ok(requested.includes("/api/inventory/alerts?branchId=1"));
    const secondBranch = [...document.querySelectorAll("button")].find((button) => button.textContent === "Choose second branch");
    assert.ok(secondBranch);
    await act(async () => { secondBranch.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    resolveMain(Response.json({ success: true, alerts: [alert(1, "Stale main stock")] }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assert.ok(requested.includes("/api/inventory/alerts?branchId=2"));
    const notifications = [...document.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.startsWith("View notifications"));
    assert.ok(notifications);
    await act(async () => notifications.click());
    assert.match(document.body.textContent ?? "", /Second branch stock/);
    assert.doesNotMatch(document.body.textContent ?? "", /Stale main stock/);
  } finally {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch;
  }
});
