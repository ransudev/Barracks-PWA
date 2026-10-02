import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { InventoryPage } = await import("@/app/pages/staff/InventoryPage");
const { RestockManagement } = await import("@/app/pages/admin/RestockManagement");
const pause = () => new Promise((resolve) => setTimeout(resolve,30));

test("inventory and restocks switch scoped data, discard dialogs and ignore an old history response", async () => {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  const toasts: string[] = [];
  let releaseHistory: (response: Response) => void = () => { throw new Error("History was not requested"); };
  const product = { id: 1,name: "Main product",category: "Products",quantity: 4,minimumStock: 1,maximumStock: 20,unitCost: 10,unit: "bottle",sku: "PRODUCT",status: "active",supplierId: 1,supplierName: "Shared supplier",branch: "Main Branch",imageUrl: null,createdAt: "2026-10-02T00:00:00Z",updatedAt: "2026-10-02T00:00:00Z" };
  globalThis.fetch = async (input) => {
    const path = String(input); requests.push(path);
    if (path === "/api/branch-context") return Response.json({ branches: [{ id: 1,name: "Main Branch",status: "active" },{ id: 2,name: "Second Branch",status: "active" }],primaryBranch: { id: 1 } });
    if (path === "/api/suppliers") return Response.json({ success: true,suppliers: [{ id: 1,companyName: "Shared supplier",status: "active" }] });
    if (path === "/api/inventory?branchId=1") return Response.json({ success: true,items: [product] });
    if (path === "/api/inventory?branchId=2") return Response.json({ success: true,items: [{ ...product,id: 2,name: "Second product",quantity: 9,branch: "Second Branch" }] });
    if (path === "/api/inventory/1/movements?branchId=1") return new Promise<Response>((resolve) => { releaseHistory=resolve; });
    if (path.startsWith("/api/restocks?branchId=")) {
      const second = path.endsWith("2");
      return Response.json({ success: true,restocks: [{ id: second ? 2 : 1,supplier_id: 1,supplier_name: second ? "Second delivery" : "Main delivery",status: "Pending",branch: second ? "Second Branch" : "Main Branch",reference: null,notes: "",created_at: "2026-10-02T00:00:00Z",received_at: null,items: [] }] });
    }
    throw new Error(`Unexpected request ${path}`);
  };
  const notify = (message: string) => { toasts.push(message); };
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const click = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find((element) => element.textContent===label || element.getAttribute("aria-label")===label);
    assert.ok(button,`Missing ${label}`);
    await act(async () => { button.click(); await pause(); });
  };
  const switchBranch = async () => {
    const selector = container.querySelector("select")!;
    await act(async () => { selector.value="2"; selector.dispatchEvent(new dom.window.Event("change",{ bubbles: true })); await pause(); });
    await act(pause);
  };
  try {
    await act(async () => { root.render(<InventoryPage canDelete onToast={notify} />); await pause(); });
    await act(pause);
    assert.match(container.textContent ?? "",/Main product/);
    await click("Open Main product");
    await click("Add item");
    assert.ok(container.querySelector('[role="dialog"]'));
    await switchBranch();
    assert.match(container.textContent ?? "",/Second product/);
    assert.doesNotMatch(container.textContent ?? "",/Main product|Add inventory item/);
    assert.equal(container.querySelector('[role="dialog"]'),null);
    await act(async () => { releaseHistory(Response.json({ success: false,message: "Stale branch error" },{ status: 500 })); await pause(); });
    assert.deepEqual(toasts,[]);
    await act(async () => { root.render(<RestockManagement onToast={notify} />); await pause(); });
    await act(pause);
    assert.match(container.textContent ?? "",/Main delivery/);
    await click("New request");
    assert.ok(container.querySelector('[role="dialog"]'));
    await switchBranch();
    assert.match(container.textContent ?? "",/Second delivery/);
    assert.doesNotMatch(container.textContent ?? "",/Main delivery|Create restock request/);
    assert.equal(container.querySelector('[role="dialog"]'),null);
    assert.ok(requests.includes("/api/inventory?branchId=2"));
    assert.ok(requests.includes("/api/restocks?branchId=2"));
  } finally {
    await act(async () => root.unmount()); container.remove(); globalThis.fetch=previous;
  }
});
