import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeStaffLifecycle,
  canCreateStaffUser,
  canDeactivateStaffUser,
  canUpdateStaffUser,
  canViewStaffUser,
} from "@/app/constants/roles";

type StaffRole = "administrator" | "manager" | "front_desk";

test("staff account authorization matrix enforces route policy for create, update, lifecycle, and deactivate", () => {
  const createCases: Array<{
    actorRole: StaffRole;
    desiredRole: StaffRole;
    allowed: boolean;
  }> = [
    { actorRole: "administrator", desiredRole: "administrator", allowed: true },
    { actorRole: "administrator", desiredRole: "manager", allowed: true },
    { actorRole: "administrator", desiredRole: "front_desk", allowed: true },
    { actorRole: "manager", desiredRole: "front_desk", allowed: true },
    { actorRole: "manager", desiredRole: "manager", allowed: false },
    { actorRole: "manager", desiredRole: "administrator", allowed: false },
  ];

  for (const scenario of createCases) {
    assert.equal(
      canCreateStaffUser(scenario.actorRole, scenario.desiredRole),
      scenario.allowed,
      `create: ${scenario.actorRole} -> ${scenario.desiredRole}`,
    );
  }

  const viewCases: Array<{
    actorRole: StaffRole;
    targetRole: StaffRole;
    allowed: boolean;
  }> = [
    { actorRole: "administrator", targetRole: "administrator", allowed: true },
    { actorRole: "administrator", targetRole: "manager", allowed: true },
    { actorRole: "administrator", targetRole: "front_desk", allowed: true },
    { actorRole: "manager", targetRole: "manager", allowed: true },
    { actorRole: "manager", targetRole: "front_desk", allowed: true },
    { actorRole: "manager", targetRole: "administrator", allowed: false },
  ];

  for (const scenario of viewCases) {
    assert.equal(
      canViewStaffUser(scenario.actorRole, scenario.targetRole),
      scenario.allowed,
      `view: ${scenario.actorRole} -> ${scenario.targetRole}`,
    );
  }

  const targetCases: Array<{
    label: string;
    actorRole: StaffRole;
    targetRole: StaffRole;
    desiredRole: StaffRole;
    actorId: number;
    targetId: number;
    update: boolean;
    lifecycle: boolean;
    deactivate: boolean;
  }> = [
    {
      label: "administrator may manage another administrator",
      actorRole: "administrator",
      targetRole: "administrator",
      desiredRole: "administrator",
      actorId: 1,
      targetId: 2,
      update: true,
      lifecycle: true,
      deactivate: true,
    },
    {
      label: "administrator may update and lifecycle-manage itself but not deactivate itself",
      actorRole: "administrator",
      targetRole: "administrator",
      desiredRole: "administrator",
      actorId: 1,
      targetId: 1,
      update: true,
      lifecycle: true,
      deactivate: false,
    },
    {
      label: "administrator may manage manager accounts",
      actorRole: "administrator",
      targetRole: "manager",
      desiredRole: "manager",
      actorId: 1,
      targetId: 2,
      update: true,
      lifecycle: true,
      deactivate: true,
    },
    {
      label: "administrator may manage front desk accounts",
      actorRole: "administrator",
      targetRole: "front_desk",
      desiredRole: "front_desk",
      actorId: 1,
      targetId: 3,
      update: true,
      lifecycle: true,
      deactivate: true,
    },
    {
      label: "manager may manage a different front desk account",
      actorRole: "manager",
      targetRole: "front_desk",
      desiredRole: "front_desk",
      actorId: 2,
      targetId: 3,
      update: true,
      lifecycle: true,
      deactivate: true,
    },
    {
      label: "manager cannot promote a front desk account",
      actorRole: "manager",
      targetRole: "front_desk",
      desiredRole: "manager",
      actorId: 2,
      targetId: 3,
      update: false,
      lifecycle: true,
      deactivate: true,
    },
    {
      label: "manager cannot target itself",
      actorRole: "manager",
      targetRole: "manager",
      desiredRole: "manager",
      actorId: 2,
      targetId: 2,
      update: false,
      lifecycle: false,
      deactivate: false,
    },
    {
      label: "manager cannot target another manager",
      actorRole: "manager",
      targetRole: "manager",
      desiredRole: "manager",
      actorId: 2,
      targetId: 4,
      update: false,
      lifecycle: false,
      deactivate: false,
    },
    {
      label: "manager cannot target an administrator",
      actorRole: "manager",
      targetRole: "administrator",
      desiredRole: "administrator",
      actorId: 2,
      targetId: 1,
      update: false,
      lifecycle: false,
      deactivate: false,
    },
    {
      label: "front desk cannot deactivate itself",
      actorRole: "front_desk",
      targetRole: "front_desk",
      desiredRole: "front_desk",
      actorId: 3,
      targetId: 3,
      update: false,
      lifecycle: false,
      deactivate: false,
    },
  ];

  for (const scenario of targetCases) {
    assert.equal(
      canUpdateStaffUser(
        scenario.actorRole,
        scenario.targetRole,
        scenario.actorId,
        scenario.targetId,
        scenario.desiredRole,
      ),
      scenario.update,
      `update: ${scenario.label}`,
    );
    assert.equal(
      canChangeStaffLifecycle(scenario.actorRole, scenario.targetRole, scenario.actorId, scenario.targetId),
      scenario.lifecycle,
      `lifecycle: ${scenario.label}`,
    );
    assert.equal(
      canDeactivateStaffUser(scenario.actorRole, scenario.targetRole, scenario.actorId, scenario.targetId),
      scenario.deactivate,
      `deactivate: ${scenario.label}`,
    );
  }
});
