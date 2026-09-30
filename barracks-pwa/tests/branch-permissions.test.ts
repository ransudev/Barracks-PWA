import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { ApiRole } from "@/app/lib/api";

let role: ApiRole | null = null;
let databaseCalls = 0;
const branch = { id: 1, name: "Main Branch", code: "MAIN", address: "", phone: "", status: "active", created_at: new Date(), updated_at: new Date() };
mock.module("@/server/auth/session", { namedExports: { getCurrentUser: async () => role ? { id: 1, role } : null } });
mock.module("@/server/db/pool", { namedExports: { pool: {
  query: async (sql: string) => { databaseCalls++; return { rows: sql.includes("FROM branches") || sql.includes("RETURNING") ? [branch] : [], rowCount: 1 }; },
  connect: async () => {
    databaseCalls++;
    return { query: async () => ({ rows: [{ role: "customer", deleted_at: null }], rowCount: 1 }), release() {} };
  },
} } });
const collection = await import("@/app/api/branches/route");
const item = await import("@/app/api/branches/[id]/route");
const assignments = await import("@/app/api/branches/[id]/assignments/route");
const membership = await import("@/app/api/branches/[id]/assignments/[userId]/route");
const context = await import("@/app/api/branch-context/route");
const params = { params: Promise.resolve({ id: "1", userId: "2" }) };
const request = (body: unknown) => new Request("http://localhost/api/branches", { method: "POST", body: JSON.stringify(body) });

test("all branch management endpoints require Administrator before database access", async () => {
  const operations = [
    () => collection.GET(),
    () => collection.POST(request({ name: "New", code: "NEW" })),
    () => item.PATCH(request({ status: "inactive" }), params),
    () => assignments.GET(request({}), params),
    () => assignments.POST(request({ userId: 2 }), params),
    () => membership.PATCH(request({ isPrimary: true }), params),
    () => membership.DELETE(request({}), params),
  ];
  for (role of [null, "manager", "front_desk", "customer", "supplier"] as const) {
    for (const operation of operations) {
      databaseCalls = 0;
      assert.equal((await operation()).status, role ? 403 : 401);
      assert.equal(databaseCalls, 0);
    }
  }
  role = "administrator";
  for (const operation of operations) {
    databaseCalls = 0;
    const response = await operation();
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
    assert.ok(databaseCalls > 0);
  }
});

test("Administrator branch CRUD returns success and validates inputs", async () => {
  role = "administrator";
  assert.equal((await collection.GET()).status, 200);
  assert.equal((await collection.POST(request({ name: "New", code: "NEW" }))).status, 201);
  assert.equal((await item.PATCH(request({ name: "Renamed", status: "inactive" }), params)).status, 200);
  for (const input of [{ name: "", code: "NEW" }, { name: "New", code: "bad code" }, { name: "New", code: "NEW", unknown: true }]) {
    assert.equal((await collection.POST(request(input))).status, 400);
  }
  assert.equal((await item.PATCH(request({}), params)).status, 400);
  assert.equal((await item.PATCH(request({ status: "deleted" }), params)).status, 400);
  assert.equal((await assignments.POST(request({ userId: 2 }), params)).status, 400);
  assert.equal((await membership.PATCH(request({ isPrimary: false }), params)).status, 400);
});

test("branch context excludes customer and supplier roles", async () => {
  for (role of [null, "customer", "supplier"] as const) assert.equal((await context.GET()).status, role ? 403 : 401);
  for (role of ["administrator", "manager", "front_desk"] as const) assert.equal((await context.GET()).status, 200);
});
