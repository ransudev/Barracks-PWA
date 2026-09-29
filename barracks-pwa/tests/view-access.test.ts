import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigation, frontDeskNavigation, managerNavigation, viewAccessGroups } from "@/app/constants/navigation";
import type { ViewId } from "@/app/types/domain";
import { viewPaths } from "@/app/utils/routes";
import { canAccessView, canonicalView, isAdminView, requiresAdministrator, requiresManagement, workspaceAreaForView } from "@/app/utils/view";

test("every route has a view-access group and Manager navigation remains independent", () => {
  assert.deepEqual(Object.keys(viewAccessGroups).sort(), Object.keys(viewPaths).sort());
  assert.deepEqual(managerNavigation, adminNavigation);
  assert.notEqual(managerNavigation, adminNavigation);
  assert.deepEqual(frontDeskNavigation.map((item) => item.id), ["staff-dashboard", "queue", "bookings", "payments", "customers", "barbers"]);
  assert.equal(frontDeskNavigation.find((item) => item.id === "barbers")?.label, "Barber Floor");
  assert.deepEqual(managerNavigation.map((item) => item.id), ["admin-dashboard", "staff-management", "admin-customers", "admin-barbers", "admin-suppliers", "admin-restocks", "admin-reports", "payments", "admin-inventory", "admin-services"]);
  assert.equal(managerNavigation.find((item) => item.id === "payments")?.label, "Transactions");
});

test("direct view access matches role navigation", () => {
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
    ["queue", "manager", false],
    ["queue", "administrator", true],
    ["queue", "customer", false],
    ["barbers", "front_desk", true],
    ["barbers", "manager", false],
    ["admin-barbers", "front_desk", false],
    ["admin-barbers", "manager", true],
    ["payments", "front_desk", true],
    ["payments", "manager", true],
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
  for (const item of frontDeskNavigation) assert.equal(canAccessView(item.id, "front_desk"), true, item.id);
  for (const item of managerNavigation) assert.equal(canAccessView(item.id, "manager"), true, item.id);
  for (const item of adminNavigation) assert.equal(canAccessView(item.id, "administrator"), true, item.id);
  for (const view of ["inventory", "staff-suppliers", "restocks", "admin-inventory", "admin-suppliers", "admin-restocks", "admin-reports", "admin-services", "staff-management"] as ViewId[]) {
    assert.equal(canAccessView(view, "front_desk"), false, view);
  }
  for (const view of ["staff-dashboard", "queue", "bookings", "customers", "barbers"] as ViewId[]) {
    assert.equal(canAccessView(view, "manager"), false, view);
  }
  assert.equal(canonicalView("inventory"), "admin-inventory");
  assert.equal(canonicalView("staff-suppliers"), "admin-suppliers");
  assert.equal(canonicalView("restocks"), "admin-restocks");
  assert.equal(canonicalView("barbers"), "barbers");
  assert.equal(workspaceAreaForView("payments", "front_desk"), "staff");
  assert.equal(workspaceAreaForView("payments", "manager"), "admin");
  assert.equal(workspaceAreaForView("payments", "administrator"), "admin");
  assert.equal(workspaceAreaForView("admin-barbers", "manager"), "admin");
  assert.equal(workspaceAreaForView("barbers", "administrator"), "staff");
  assert.equal(isAdminView("staff-management"), true);
  assert.equal(requiresManagement("staff-management"), true);
  assert.equal(requiresAdministrator("staff-management"), false);
  assert.equal(Object.values(viewAccessGroups).includes("administrator"), false);
});
