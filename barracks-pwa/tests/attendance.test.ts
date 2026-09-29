import assert from "node:assert/strict";
import test from "node:test";
import { attendanceActionSchema, attendanceCorrectionSchema } from "@/server/schemas/attendance.schema";
import { actOnTodayAttendance, AttendanceConflict, correctAttendance, listAttendanceCorrections, listAttendanceHistory, listTodayAttendance } from "@/server/services/attendance.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("attendance input accepts only daily actions and requires a reason for corrections", () => {
  for (const status of ["present", "late", "absent"]) assert.equal(attendanceActionSchema.safeParse({ action: "mark", status }).success, true);
  assert.equal(attendanceActionSchema.safeParse({ action: "clock_in" }).success, true);
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
    assert.equal((await listAttendanceCorrections(db, clockedOut!.id)).length, 2);
  } finally { await cleanup(); }
});
