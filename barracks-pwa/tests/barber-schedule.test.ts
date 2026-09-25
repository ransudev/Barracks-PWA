import assert from "node:assert/strict";
import test from "node:test";
import { createBarber } from "@/server/services/barber.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("new barber receives seven current shop days atomically", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    await db.query("UPDATE shop_operating_hours SET open_time='10:00',close_time='18:00',is_closed=true WHERE day_of_week=0");
    const barber = await createBarber(db, { firstName: "Schedule", lastName: "Test", status: "available" });
    assert.equal(barber.scheduleDayCount, 7);
    const shifts = await db.query<{ day_of_week: number; is_working: boolean; start_time: string; end_time: string }>(
      "SELECT day_of_week,is_working,start_time,end_time FROM barber_schedules WHERE barber_id=$1 ORDER BY day_of_week", [barber.id]);
    assert.deepEqual(shifts.rows.map((row) => row.day_of_week), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(shifts.rows[0], { day_of_week: 0, is_working: false, start_time: "10:00:00", end_time: "18:00:00" });

    await db.query("DELETE FROM shop_operating_hours WHERE day_of_week=6");
    await assert.rejects(createBarber(db, { firstName: "Incomplete", lastName: "Test", status: "available" }), /seven shop days/);
    assert.equal(Number((await db.query("SELECT count(*) AS count FROM barbers")).rows[0].count), 1);
  } finally { await cleanup(); }
});
