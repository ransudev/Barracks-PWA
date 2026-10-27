import assert from "node:assert/strict";
import test from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

// D01 accepted by the owner on 2026-10-11.

test("D01 staff branch scope, atomic creation, current authority, and membership races", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  const users = await import("@/server/services/user.service");
  const {mutateAssignment}=await import("@/server/services/branch.service");
  try {
    const a = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const b = Number((await db.query("INSERT INTO branches(name,code) VALUES('Scope B','SCOPE-B') RETURNING id")).rows[0].id);
    async function fixture(role: "administrator" | "manager" | "front_desk", label: string, branches: number[]) {
      const id = Number((await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id,is_verified)
        VALUES($1,'Scope',$2,'hash',(SELECT id FROM roles WHERE name=$3),TRUE) RETURNING id`, [label, `${label}@scope.test`, role])).rows[0].id);
      for (const branch of branches) await db.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)", [id, branch]);
      return id;
    }
    const admin = await fixture("administrator", "admin", []);
    const otherAdmin = await fixture("administrator", "other-admin", []);
    const managerA = await fixture("manager", "manager-a", [a]);
    const managerB = await fixture("manager", "manager-b", [b]);
    const local = await fixture("front_desk", "local", [a]);
    const foreign = await fixture("front_desk", "foreign", [b]);
    const shared = await fixture("front_desk", "shared", [a, b]);
    const unassigned = await fixture("front_desk", "unassigned", []);
    const update = { firstName: "Changed", lastName: "Scope", email: "changed@scope.test", role: "front_desk" as const, password: "password123" };

    const roster = await users.listStaffUsers(db, managerA);
    assert.deepEqual(roster.map((user) => user.id).sort((x,y)=>x-y), [local, shared].sort((x,y)=>x-y));
    assert.deepEqual(roster.find((user)=>user.id===shared)?.branchIds, [a], "foreign membership IDs must not be exposed");
    assert.equal(roster.find((user)=>user.id===shared)?.canManageAccount, false);
    assert.equal(roster.find((user)=>user.id===local)?.canManageAccount, true);
    assert.equal(await users.findStaffUserById(db, managerA, foreign), null);
    assert.equal(await users.findStaffUserById(db, managerA, unassigned), null);
    assert.equal(await users.findStaffUserById(db, managerA, otherAdmin), null);
    assert.ok(await users.findStaffUserById(db, admin, unassigned));
    assert.ok(await users.findStaffUserById(db, admin, otherAdmin));
    assert.equal((await users.updateUserLifecycle(db,admin,{action:"block"},admin)).kind,"forbidden");
    assert.equal((await users.softDeleteUser(db,admin,admin)).kind,"forbidden");
    assert.equal((await users.updateStaffUser(db,admin,{...update,role:"manager"},admin)).kind,"forbidden");
    await assert.rejects(mutateAssignment(db,b,local,"assign",false,managerA),/Administrator access/);
    await mutateAssignment(db,b,unassigned,"assign",false,admin);
    await mutateAssignment(db,b,unassigned,"remove",false,admin);
    assert.deepEqual(await users.listStaffUsers(db, local), []);

    for (const target of [foreign, shared, unassigned, managerB, otherAdmin]) {
      assert.equal((await users.updateStaffUser(db, target, update, managerA)).kind, "forbidden");
      assert.equal((await users.updateUserLifecycle(db, target, {action:"block"}, managerA)).kind, "forbidden");
      assert.equal((await users.softDeleteUser(db, target, managerA)).kind, "forbidden");
      assert.equal((await db.query("SELECT is_blocked,deleted_at FROM users WHERE id=$1",[target])).rows[0].is_blocked,false);
      assert.equal((await db.query("SELECT deleted_at FROM users WHERE id=$1",[target])).rows[0].deleted_at,null);
    }
    assert.equal((await users.updateStaffUser(db, local, {...update, role:"manager"}, managerA)).kind,"forbidden");
    assert.equal((await users.updateStaffUser(db, local, update, managerA)).kind,"updated");
    assert.equal((await users.updateUserLifecycle(db, local, {action:"block"}, managerA)).kind,"updated");
    assert.equal((await users.updateUserLifecycle(db, local, {action:"unblock"}, admin)).kind,"updated");
    assert.equal((await users.updateUserLifecycle(db, otherAdmin, {action:"block"}, admin)).kind,"forbidden", "existing Administrator protection remains");

    const create = { firstName:"Atomic",lastName:"Scope",email:"atomic@scope.test",password:"password123",role:"front_desk" as const,branchIds:[a] };
    assert.equal((await users.createStaffUser(db, managerA, {...create, branchIds:[]})).kind,"forbidden");
    assert.equal((await users.createStaffUser(db, managerA, {...create, branchIds:[a,b]})).kind,"forbidden");
    assert.equal((await db.query("SELECT id FROM users WHERE email=$1",[create.email])).rowCount,0);
    const created = await users.createStaffUser(db, managerA, create);
    assert.equal(created.kind,"created");
    if(created.kind!=="created") throw new Error("Creation failed");
    assert.deepEqual((await db.query("SELECT branch_id FROM user_branches WHERE user_id=$1",[created.user.id])).rows.map(row=>Number(row.branch_id)),[a]);

    // Force membership insert failure after account insertion to prove rollback.
    await db.query(`CREATE FUNCTION reject_scope_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF (SELECT email FROM users WHERE id=NEW.user_id)='rollback@scope.test' THEN RAISE EXCEPTION 'fixture membership failure'; END IF;
      RETURN NEW; END $$`);
    await db.query("CREATE TRIGGER reject_scope_membership BEFORE INSERT ON user_branches FOR EACH ROW EXECUTE FUNCTION reject_scope_membership()");
    await assert.rejects(users.createStaffUser(db,managerA,{...create,email:"rollback@scope.test"}),/fixture membership failure/);
    assert.equal((await db.query("SELECT id FROM users WHERE email='rollback@scope.test'")).rowCount,0);

    // Membership writes lock the same user row. A revocation already holding
    // the actor lock must commit before sensitive mutation rechecks authority.
    const revoke = await db.connect();
    try {
      await revoke.query("BEGIN");
      await revoke.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[managerA]);
      await revoke.query("DELETE FROM user_branches WHERE user_id=$1 AND branch_id=$2",[managerA,a]);
      const mutation = users.updateUserLifecycle(db,local,{action:"block"},managerA);
      await revoke.query("COMMIT");
      assert.equal((await mutation).kind,"forbidden");
      assert.equal((await db.query("SELECT is_blocked FROM users WHERE id=$1",[local])).rows[0].is_blocked,false);
    } finally { await revoke.query("ROLLBACK"); revoke.release(); }
    assert.deepEqual(await users.listStaffUsers(db,managerA),[]);
    await db.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)",[managerA,a]);
    const targetChange = await db.connect();
    try {
      await targetChange.query("BEGIN");
      await targetChange.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[local]);
      await targetChange.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)",[local,b]);
      const mutation = users.softDeleteUser(db,local,managerA);
      await targetChange.query("COMMIT");
      assert.equal((await mutation).kind,"forbidden");
    } finally { await targetChange.query("ROLLBACK"); targetChange.release(); }
    await db.query("UPDATE users SET role_id=(SELECT id FROM roles WHERE name='front_desk') WHERE id=$1",[managerA]);
    assert.equal((await users.updateUserLifecycle(db,created.user.id,{action:"block"},managerA)).kind,"forbidden","current role beats the request's earlier authorization");
    assert.equal((await users.softDeleteUser(db,unassigned,admin)).kind,"deleted");
    await db.query("UPDATE users SET role_id=(SELECT id FROM roles WHERE name='manager') WHERE id=$1",[otherAdmin]);
    await assert.rejects(mutateAssignment(db,b,created.user.id,"assign",false,otherAdmin),/Administrator access/,"membership writes recheck current role");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='administrator' AND u.deleted_at IS NULL AND u.is_verified AND NOT u.is_blocked")).rows[0].n,1);
  } finally { await cleanup(); }
});
