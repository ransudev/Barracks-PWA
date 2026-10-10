import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { ApiRole } from "@/app/lib/api";
import { viewAccessGroups, managementNavigation, frontDeskNavigation } from "@/app/constants/navigation";
let role: ApiRole | null=null;
let calls=0;
mock.module("@/server/auth/session",{namedExports:{getCurrentUser:async()=>role ? {id:1,role} : null}});
mock.module("@/server/db/pool",{namedExports:{pool:{query:async()=>{calls++;throw new Error('Unexpected database call');},connect:async()=>{calls++;throw new Error('Unexpected database call');}}}});
const routes=await import("@/app/api/payroll/route");
test("payroll denies anonymous, Front Desk, customer and supplier before querying the database",async()=>{
  for(role of [null,'front_desk','customer','supplier'] as const) {
    calls=0;
    const get=await routes.GET(new Request('http://localhost/api/payroll?branchId=1'));
    assert.equal(get.status,role ? 403 : 401);
    for(const action of ['configure','rate','correct_snapshot','generate','supplement','adjust','submit','return','approve','pay']) {
      const post=await routes.POST(new Request('http://localhost/api/payroll',{method:'POST',body:JSON.stringify({action,branchId:1,recordId:1})}));
      assert.equal(post.status,role ? 403 : 401);
    }
    assert.equal(calls,0);
  }
  assert.equal(viewAccessGroups['admin-payroll'],'management');
  assert.equal(frontDeskNavigation.some(n=>n.id==='admin-payroll'),false);
  assert.equal(managementNavigation.some(n=>n.id==='admin-payroll'),true);
});
test("payroll rejects malformed branch, dates, and client-supplied approval or monetary totals before database access",async()=>{
  role='manager'; calls=0;
  for(const query of ['', '?branchId=0','?branchId=1&periodStart=2026-02-30']) assert.equal((await routes.GET(new Request(`http://localhost/api/payroll${query}`))).status,400);
  for(const body of [{action:'approve',branchId:1,recordId:1,approvedBy:99},{action:'pay',branchId:1,recordId:1,amountCentavos:'1'},{action:'rate',branchId:1,barberId:1,rate:'45',reason:''}]) {
    assert.equal((await routes.POST(new Request('http://localhost/api/payroll',{method:'POST',body:JSON.stringify(body)}))).status,400);
  }
  assert.equal(calls,0);
});
