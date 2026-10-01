import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Pool } from "pg";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";
import { createBarber } from "@/server/services/barber.service";
import type { UserRole } from "@/server/schemas/user.schema";
let db: Pool;
let actor: { id: number; role: UserRole } | null;
mock.module("@/server/auth/session", { namedExports: { getCurrentUser: async () => actor } });
mock.module("@/server/db/pool", { namedExports: { pool: { query: (...args: Parameters<Pool["query"]>) => db.query(...args), connect: () => db.connect() } } });
const collection = await import("@/app/api/barbers/route");
const item = await import("@/app/api/barbers/[id]/route");
const status = await import("@/app/api/barbers/[id]/status/route");
const schedule = await import("@/app/api/barbers/[id]/schedule/route");
const hours = await import("@/app/api/shop-hours/route");
const request = (body: unknown = {}, query = "") => new Request(`http://localhost/api/barbers${query}`, { method: "POST", body: JSON.stringify(body) });

test("barber and hours APIs enforce assigned branches, roles and IDs; Administrator remains global", { skip: !databaseConfigured }, async () => {
  const fixture = await createDisposableSchema(); db = fixture.db;
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Second','SECOND') RETURNING id")).rows[0].id);
    const a = await createBarber(db, { branchId: main, firstName: "Main", lastName: "Barber", status: "available" });
    const b = await createBarber(db, { branchId: second, firstName: "Second", lastName: "Barber", status: "available" });
    const foreign = { params: Promise.resolve({ id: String(b.id) }) };
    const shift = { dayOfWeek: 1, isWorking: true, startTime: "10:00", endTime: "18:00", breaks: [] };
    const mainBarberIds = [a.id];
    for (const role of ["manager", "front_desk"] as const) {
      const id = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Staff','Test',$1,'test',(SELECT id FROM roles WHERE name=$2)) RETURNING id", [`${role}@test.local`, role])).rows[0].id);
      await db.query("INSERT INTO user_branches(user_id,branch_id,is_primary) VALUES($1,$2,true)", [id, main]); actor = { id, role };
      assert.deepEqual((await (await collection.GET(request())).json()).barbers.map((barber: { id: number }) => barber.id).sort(), [...mainBarberIds].sort());
      assert.equal((await collection.GET(request({}, `?branchId=${second}`))).status, 403);
      assert.equal((await item.GET(request(), foreign)).status, 403);
      assert.equal((await status.PATCH(request({ status: "busy" }), foreign)).status, 403);
      for (const op of [() => schedule.GET(request(), foreign), () => schedule.PUT(request(shift), foreign), () => schedule.POST(request({ startsAt: "2099-10-01T10:00:00Z", endsAt: "2099-10-01T11:00:00Z", reason: "Away" }), foreign), () => schedule.DELETE(request({}, "?periodId=1"), foreign)]) assert.equal((await op()).status, 403);
      assert.equal((await hours.GET(request({}, `?branchId=${second}`))).status, 403);
      assert.equal((await hours.PUT(request({ dayOfWeek: 1, openTime: "10:00", closeTime: "18:00", isClosed: false }, `?branchId=${second}`))).status, 403);
      assert.equal((await collection.POST(request({ branchId: second, firstName: "Denied", lastName: "Test", status: "available" }))).status, 403);
      assert.equal((await item.PUT(request({ branchId: main, firstName: "Denied", lastName: "Test", status: "available" }), foreign)).status, 403);
      assert.equal((await hours.GET(request({}, `?branchId=${main}`))).status, 200);
      assert.equal((await hours.PUT(request({ dayOfWeek: 1, openTime: "09:00", closeTime: "19:30", isClosed: false }, `?branchId=${main}`))).status, role === "manager" ? 200 : 403);
      if (role === "manager") {
        const created = await collection.POST(request({ branchId: main, firstName: "Manager", lastName: "Created", status: "available" }));
        assert.equal(created.status, 201); mainBarberIds.push((await created.json()).barber.id);
        assert.equal((await schedule.PUT(request(shift), { params: Promise.resolve({ id: String(a.id) }) })).status, 200);
        assert.equal((await item.PUT(request({ branchId: main, firstName: "Denied", lastName: "Test", status: "available", commissionRate: 90 }), { params: Promise.resolve({ id: String(a.id) }) })).status, 400);
        assert.equal((await collection.POST(request({ firstName: "Missing", lastName: "Branch", status: "available" }))).status, 400);
        await db.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)", [id, second]);
        assert.equal((await schedule.GET(request(), foreign)).status, 200);
        assert.equal((await collection.GET(request({}, `?branchId=${second}`))).status, 200);
      } else {
        assert.equal((await schedule.GET(request(), { params: Promise.resolve({ id: String(a.id) }) })).status, 403);
      }
    }
    actor = { id: 999, role: "administrator" };
    assert.equal((await (await collection.GET(request())).json()).barbers.length, 3);
    assert.equal((await item.GET(request(), foreign)).status, 200);
    assert.equal((await schedule.GET(request(), foreign)).status, 200);
    assert.equal((await hours.PUT(request({ dayOfWeek: 1, openTime: "11:00", closeTime: "18:00", isClosed: false }, `?branchId=${second}`))).status, 200);
    assert.equal((await collection.POST(request({ branchId: second, firstName: "Admin", lastName: "Created", status: "available", commissionRate: null }))).status, 201);
    for (const role of ["customer", "supplier"] as const) {
      actor = { id: 999, role };
      for (const op of [() => item.GET(request(), foreign), () => status.PATCH(request({ status: "busy" }), foreign), () => schedule.GET(request(), foreign), () => collection.POST(request({})), () => hours.PUT(request({}))]) assert.equal((await op()).status, 403);
    }
    actor = null; assert.equal((await collection.GET(request())).status, 401);
  } finally { await fixture.cleanup(); }
});
