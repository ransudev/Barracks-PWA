import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigation, managerNavigation, viewAccessGroups } from "@/app/constants/navigation";
import type { ViewId } from "@/app/types/domain";
import { viewPaths } from "@/app/utils/routes";
import { canAccessView, isAdminView, requiresAdministrator, requiresManagement } from "@/app/utils/view";

test("every route has a view-access group and Manager navigation remains independent", () => {
  assert.deepEqual(Object.keys(viewAccessGroups).sort(), Object.keys(viewPaths).sort());
  assert.deepEqual(managerNavigation, adminNavigation);
  assert.notEqual(managerNavigation, adminNavigation);
});

test("view access preserves current page permissions", () => {
  const cases: Array<[ViewId, string | null, boolean]> = [
    ["landing", null, true],
    ["customer-dashboard", "customer", true],
    ["customer-dashboard", "front_desk", false],
    ["supplier-dashboard", "supplier", true],
    ["supplier-dashboard", "manager", false],
    ["staff-dashboard", "front_desk", true],
    ["staff-dashboard", "administrator", true],
    ["staff-dashboard", "manager", false],
    ["queue", "front_desk", true],
    ["queue", "manager", true],
    ["queue", "administrator", true],
    ["queue", "customer", false],
    ["staff-management", "front_desk", false],
    ["staff-management", "manager", true],
    ["staff-management", "administrator", true],
    ["admin-services", "manager", true],
    ["admin-services", "administrator", true],
    ["admin-services", null, false],
  ];
  for (const [view, role, allowed] of cases) {
    assert.equal(canAccessView(view, role), allowed, `${role} -> ${view}`);
  }
  assert.equal(isAdminView("staff-management"), true);
  assert.equal(requiresManagement("staff-management"), true);
  assert.equal(requiresAdministrator("staff-management"), false);
  assert.equal(Object.values(viewAccessGroups).includes("administrator"), false);
});
