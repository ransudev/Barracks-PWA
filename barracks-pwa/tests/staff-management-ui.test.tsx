import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { ApiRole, ApiUser } from "@/app/lib/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window.HTMLElement;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { StaffManagement } = await import("@/app/pages/admin/StaffManagement");

function account(id: number, role: ApiRole): ApiUser {
  return { id, firstName: role, lastName: "User", email: `${role}@example.test`, role, isVerified: true, isBlocked: false, isActive: true, createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z" };
}

async function renderStaff(role: ApiRole) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/users") return Response.json({ success: true, users: [account(1, "administrator"), account(2, "manager"), account(3, "front_desk")] });
    throw new Error(`Unexpected request ${input}`);
  };
  const container = dom.window.document.createElement("div");
  dom.window.document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<StaffManagement currentUserId={role === "administrator" ? 1 : 2} currentUserRole={role} onToast={() => undefined} />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); globalThis.fetch = previousFetch; } };
}

test("Manager Staff page shows only Front Desk accounts and creation roles", async () => {
  const page = await renderStaff("manager");
  try {
    assert.match(page.container.textContent ?? "", /Front Desk accounts/);
    assert.match(page.container.textContent ?? "", /front_desk User/);
    assert.equal(page.container.textContent?.includes("manager User"), false);
    assert.equal(page.container.textContent?.includes("administrator User"), false);
    const filter = page.container.querySelector('select[aria-label="Filter accounts by role"]') as HTMLSelectElement;
    assert.deepEqual(Array.from(filter.options).map((option) => option.textContent), ["All roles", "Front Desk"]);
    await act(async () => { Array.from(page.container.querySelectorAll("button")).find((button) => button.textContent === "Create account")!.click(); });
    const roleSelect = Array.from(page.container.querySelectorAll("select")).find((select) => select.labels?.[0]?.textContent?.includes("Role"))!;
    assert.deepEqual(Array.from(roleSelect.options).map((option) => option.textContent), ["Front Desk"]);
  } finally { await page.cleanup(); }
});

test("Administrator Staff page retains Manager and Front Desk account actions", async () => {
  const page = await renderStaff("administrator");
  try {
    assert.match(page.container.textContent ?? "", /manager User/);
    assert.match(page.container.textContent ?? "", /front_desk User/);
    await act(async () => { Array.from(page.container.querySelectorAll("button")).find((button) => button.textContent === "Create account")!.click(); });
    const roleSelect = Array.from(page.container.querySelectorAll("select")).find((select) => select.labels?.[0]?.textContent?.includes("Role"))!;
    assert.deepEqual(Array.from(roleSelect.options).map((option) => option.textContent), ["Administrator", "Manager", "Front Desk"]);
  } finally { await page.cleanup(); }
});
