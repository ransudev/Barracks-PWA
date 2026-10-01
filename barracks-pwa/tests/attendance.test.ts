import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { Pool } from "pg";
import type { UserRole } from "@/server/schemas/user.schema";
import { createBarber, updateBarber } from "@/server/services/barber.service";
import { applyMigrations } from "@/server/db/migrate";
import { attendanceActionSchema, attendanceCorrectionSchema } from "@/server/schemas/attendance.schema";
import { actOnTodayAttendance, AttendanceConflict, correctAttendance, listAttendanceCorrections, listAttendanceHistory, listTodayAttendance } from "@/server/services/attendance.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("attendance input accepts only daily actions and requires a reason for corrections", () => {
  for (const status of ["present", "late", "absent"]) assert.equal(attendanceActionSchema.safeParse({ action: "mark", status }).success, true);
  assert.equal(attendanceActionSchema.safeParse({ action: "clock_in" }).success, true);
  assert.equal(attendanceActionSchema.safeParse({ action: "clock_in", branchId: 99 }).success, false);
  assert.equal(attendanceActionSchema.safeParse({ action: "clock_out" }).success, true);
  assert.equal(attendanceActionSchema.safeParse({ action: "clock_out", clockOut: "2030-01-01T09:00:00Z" }).success, false);
  const base = { status: "late", clockIn: "2030-01-01T09:00:00Z", clockOut: null };
  assert.equal(attendanceCorrectionSchema.safeParse({ ...base, reason: " " }).success, false);
  assert.equal(attendanceCorrectionSchema.safeParse({ ...base, reason: "Corrected signed timesheet" }).success, true);
  assert.equal(attendanceCorrectionSchema.safeParse({ ...base, clockOut: "2030-01-01T08:00:00Z", reason: "Wrong time" }).success, false);
  assert.equal(attendanceCorrectionSchema.safeParse({ ...base, status: "absent", reason: "Wrong time" }).success, false);
});

test("daily attendance, clock rules, history filters, and immutable correction entries", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const actor = Number((await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
      VALUES('Fran','Desk','attendance-front@test.local','test',(SELECT id FROM roles WHERE name='front_desk')) RETURNING id`)).rows[0].id);
    const manager = Number((await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
      VALUES('Mae','Manager','attendance-manager@test.local','test',(SELECT id FROM roles WHERE name='manager')) RETURNING id`)).rows[0].id);
    await db.query("INSERT INTO user_branches(user_id,branch_id) SELECT id,(SELECT id FROM branches WHERE code='MAIN') FROM users WHERE id=ANY($1::integer[])", [[actor, manager]]);
    const barber = Number((await db.query("INSERT INTO barbers(first_name,last_name) VALUES('Bea','Barber') RETURNING id")).rows[0].id);
    const absentBarber = Number((await db.query("INSERT INTO barbers(first_name,last_name) VALUES('Cal','Cutter') RETURNING id")).rows[0].id);

    assert.equal((await actOnTodayAttendance(db, barber, actor, { action: "mark", status: "present" }))?.status, "present");
    assert.equal((await actOnTodayAttendance(db, barber, actor, { action: "mark", status: "late" }))?.status, "late");
    const absent = await actOnTodayAttendance(db, absentBarber, actor, { action: "mark", status: "absent" });
    assert.equal(absent?.status, "absent");
    assert.equal(absent?.clockIn, null);
    await assert.rejects(actOnTodayAttendance(db, barber, actor, { action: "clock_out" }), AttendanceConflict);
    const clockedIn = await actOnTodayAttendance(db, barber, actor, { action: "clock_in" });
    assert.equal(clockedIn?.status, "late");
    assert.ok(clockedIn?.clockIn);
    const today = (await db.query<{ date: string }>("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date::text AS date")).rows[0].date;
    assert.equal(clockedIn?.date, today);
    await assert.rejects(actOnTodayAttendance(db, barber, actor, { action: "clock_in" }), AttendanceConflict);
    const clockedOut = await actOnTodayAttendance(db, barber, actor, { action: "clock_out" });
    assert.ok(clockedOut?.clockOut);
    assert.ok(Date.parse(clockedOut!.clockOut!) >= Date.parse(clockedIn!.clockIn!));
    await assert.rejects(actOnTodayAttendance(db, barber, actor, { action: "clock_out" }), AttendanceConflict);
    await assert.rejects(actOnTodayAttendance(db, barber, actor, { action: "mark", status: "absent" }), AttendanceConflict);
    assert.equal((await listTodayAttendance(db)).length, 2);
    assert.equal((await listAttendanceHistory(db, { barberId: barber, status: "late" })).length, 1);
    assert.equal((await listAttendanceHistory(db, { barberId: barber, status: "absent" })).length, 0);
    assert.equal(Number((await db.query("SELECT count(*) FROM barber_attendance WHERE barber_id=$1", [barber])).rows[0].count), 1);
    await assert.rejects(db.query(`INSERT INTO barber_attendance(barber_id,attendance_date,status,recorded_by,updated_by)
      VALUES($1,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,'present',$2,$2)`, [barber, actor]), { code: "23505" });
    await assert.rejects(db.query(`UPDATE barber_attendance SET clock_out=clock_in - INTERVAL '1 second' WHERE barber_id=$1`, [barber]), { code: "23514" });

    const first = await correctAttendance(db, clockedOut!.id, manager, { status: "present", clockIn: clockedIn!.clockIn, clockOut: clockedOut!.clockOut, reason: "Verified roster" });
    assert.equal(first?.status, "present");
    const second = await correctAttendance(db, clockedOut!.id, manager, { status: "late", clockIn: clockedIn!.clockIn, clockOut: clockedOut!.clockOut, reason: "Manager reviewed sign-in" });
    assert.equal(second?.status, "late");
    const audit = await listAttendanceCorrections(db, clockedOut!.id);
    assert.equal(audit.length, 2);
    assert.equal(audit[0].reason, "Manager reviewed sign-in");
    assert.equal((audit[1].previousValues as { status: string }).status, "late");
    assert.equal((audit[1].newValues as { status: string }).status, "present");
    assert.equal((audit[0].previousValues as { status: string }).status, "present");
    assert.equal((audit[0].newValues as { status: string }).status, "late");
    await assert.rejects(db.query("DELETE FROM barber_attendance_corrections WHERE id=$1", [audit[0].id]), /Attendance corrections are append-only/);
    await assert.rejects(db.query("DELETE FROM barbers WHERE id=$1", [barber]), { code: "23503" });
    await assert.rejects(db.query("DELETE FROM barber_attendance WHERE barber_id=$1", [absentBarber]), /Attendance records cannot be deleted/);
    assert.equal((await listAttendanceCorrections(db, clockedOut!.id)).length, 2);
  } finally { await cleanup(); }
});

let branchDb: Pool;
let branchActor: { id: number; role: UserRole } | null = null;
mock.module("@/server/db/pool", { namedExports: { pool: { query: (...args: Parameters<Pool["query"]>) => branchDb.query(...args), connect: () => branchDb.connect() } } });
mock.module("@/server/auth/session", { namedExports: { getCurrentUser: async () => branchActor } });
const todayApi = await import("@/app/api/attendance/today/route");
const dailyApi = await import("@/app/api/attendance/today/[barberId]/route");
const historyApi = await import("@/app/api/attendance/history/route");
const correctionsApi = await import("@/app/api/attendance/[id]/corrections/route");
const request = (query = "", body: unknown = {}) => new Request(`http://localhost/api/attendance${query}`, { method: "POST", body: JSON.stringify(body) });

test("attendance snapshots branch ownership, preserves it after barber moves and authorizes stored history", { skip: !databaseConfigured }, async () => {
  const fixture = await createDisposableSchema(); branchDb = fixture.db;
  const db = fixture.db;
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Attendance branch','ATT') RETURNING id")).rows[0].id);
    const ids: Record<string, number> = {};
    for (const role of ["manager", "front_desk", "administrator"] as const) {
      ids[role] = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Attendance','Staff',$1,'test',(SELECT id FROM roles WHERE name=$2)) RETURNING id", [`branch-attendance-${role}@test.local`, role])).rows[0].id);
      if (role !== "administrator") await db.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)", [ids[role], main]);
    }
    const moved = await createBarber(db, { branchId: main, firstName: "Moved", lastName: "Barber", status: "available" });
    const other = await createBarber(db, { branchId: second, firstName: "Second", lastName: "Barber", status: "available" });
    const original = (await actOnTodayAttendance(db, moved.id, ids.front_desk, { action: "mark", status: "present" }))!;
    assert.equal(original.branchId, main);
    await updateBarber(db, moved.id, { branchId: second, firstName: "Moved", lastName: "Barber", status: "available" });
    assert.equal((await listTodayAttendance(db, [main]))[0].branchId, main);
    assert.equal((await listTodayAttendance(db, [second])).length, 0);
    await assert.rejects(actOnTodayAttendance(db, other.id, ids.front_desk, { action: "mark", status: "present" }), { status: 403 });
    const foreign = (await actOnTodayAttendance(db, other.id, ids.administrator, { action: "mark", status: "present" }))!;
    assert.equal(foreign.branchId, second);
    const dailyParams = { params: Promise.resolve({ barberId: String(other.id) }) };
    const foreignParams = { params: Promise.resolve({ id: String(foreign.id) }) };
    const correction = { status: "late" as const, clockIn: null, clockOut: null, reason: "Reviewed shift" };
    for (const role of ["manager", "front_desk"] as const) {
      branchActor = { id: ids[role], role };
      assert.equal((await todayApi.GET(request(`?branchId=${second}`))).status, 403);
      assert.deepEqual((await (await todayApi.GET(request())).json()).attendance.map((row: { id: number }) => row.id), [original.id]);
      assert.equal((await dailyApi.POST(request("", { action: "mark", status: "late" }), dailyParams)).status, 403);
    }
    branchActor = { id: ids.manager, role: "manager" };
    assert.equal((await historyApi.GET(request(`?branchId=${second}`))).status, 403);
    assert.deepEqual((await (await historyApi.GET(request())).json()).attendance.map((row: { id: number }) => row.id), [original.id]);
    assert.equal((await correctionsApi.POST(request("", correction), foreignParams)).status, 403);
    assert.equal((await (await correctionsApi.GET(request(), foreignParams)).json()).corrections.length, 0);
    const revised = await correctAttendance(db, original.id, ids.manager, correction);
    assert.equal(revised?.branchId, main, "correction authorizes the old branch even though the barber moved");
    assert.equal((await listAttendanceCorrections(db, original.id, [main])).length, 1);
    assert.equal((await listAttendanceCorrections(db, original.id, [second])).length, 0);
    await assert.rejects(db.query("UPDATE barber_attendance SET branch_id=$2 WHERE id=$1", [original.id, second]), { code: "23514", constraint: "attendance_ownership_immutable" });
    // Being assigned to the moved barber's new branch cannot change today's old record.
    await db.query("DELETE FROM user_branches WHERE user_id=$1", [ids.front_desk]);
    await db.query("INSERT INTO user_branches(user_id,branch_id) VALUES($1,$2)", [ids.front_desk, second]);
    await assert.rejects(actOnTodayAttendance(db, moved.id, ids.front_desk, { action: "clock_in" }), { status: 403 });
    const fresh = await createBarber(db, { branchId: second, firstName: "Fresh", lastName: "Attendance", status: "available" });
    const created = await actOnTodayAttendance(db, fresh.id, ids.front_desk, { action: "clock_in" });
    assert.equal(created?.branchId, second);
    branchActor = { id: ids.administrator, role: "administrator" };
    assert.equal((await (await todayApi.GET(request())).json()).attendance.length, 3);
    assert.equal((await (await historyApi.GET(request(`?branchId=${main}`))).json()).attendance.length, 1);
    assert.equal((await (await historyApi.GET(request(`?branchId=${second}`))).json()).attendance.length, 2);
    assert.equal((await correctionsApi.GET(request(), { params: Promise.resolve({ id: String(original.id) }) })).status, 200);
  } finally { await fixture.cleanup(); }
});

test("legacy attendance backfill uses Main Branch and preserves records and corrections after prior barber moves", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(25);
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Moved before backfill','OLD') RETURNING id")).rows[0].id);
    const actor = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Legacy','Manager','legacy-attendance@test.local','test',(SELECT id FROM roles WHERE name='manager')) RETURNING id")).rows[0].id);
    const barber = await createBarber(db, { branchId: main, firstName: "Legacy", lastName: "Attendance", status: "available" });
    const id = Number((await db.query("INSERT INTO barber_attendance(barber_id,attendance_date,status,recorded_by,updated_by) VALUES($1,'2026-09-20','present',$2,$2) RETURNING id", [barber.id, actor])).rows[0].id);
    await db.query("INSERT INTO barber_attendance_corrections(attendance_id,previous_values,new_values,reason,corrected_by) VALUES($1,'{}','{}','Legacy note',$2)", [id, actor]);
    const before = (await db.query("SELECT * FROM barber_attendance WHERE id=$1", [id])).rows[0];
    const audits = (await db.query("SELECT * FROM barber_attendance_corrections WHERE attendance_id=$1", [id])).rows;
    await updateBarber(db, barber.id, { branchId: second, firstName: "Legacy", lastName: "Attendance", status: "available" });
    await applyMigrations(db);
    const after = (await db.query("SELECT * FROM barber_attendance WHERE id=$1", [id])).rows[0];
    assert.equal(after.branch_id, main);
    delete after.branch_id;
    assert.deepEqual(after, before);
    assert.deepEqual((await db.query("SELECT * FROM barber_attendance_corrections WHERE attendance_id=$1", [id])).rows, audits);
  } finally { await cleanup(); }
});
