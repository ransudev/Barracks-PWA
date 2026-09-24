import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const configured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

test("PostgreSQL rejects overlapping barber and customer bookings under concurrent writes", { skip: !configured }, async () => {
  const { pool } = await import("@/server/db/pool");
  const { createBooking, BookingServiceError } = await import("@/server/services/booking.service");
  const tag = randomUUID().slice(0, 8);
  const date = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const users: number[] = [];
  const barbers: number[] = [];
  const serviceId = `test-${tag}`;
  const longServiceId = `long-${tag}`;
  try {
    await pool.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES($1,'Concurrency cut',100,45,true)", [serviceId]);
    await pool.query("INSERT INTO services(id,name,current_price,duration_minutes,active) VALUES($1,'Long cut',100,90,true)", [longServiceId]);
    for (let i = 0; i < 2; i++) {
      const user = await pool.query<{ id: number }>("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Race','Test',$1,'test',(SELECT id FROM roles WHERE name='customer')) RETURNING id", [`race-${tag}-${i}@test.local`]);
      users.push(user.rows[0].id);
      const barber = await pool.query<{ id: number }>("INSERT INTO barbers(first_name,last_name) VALUES('Race','Barber') RETURNING id");
      barbers.push(barber.rows[0].id);
      await pool.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1, day, '09:00','19:30' FROM generate_series(0,6) AS day", [barber.rows[0].id]);
    }
    const customers = await Promise.all(users.map(async (userId) => (await pool.query<{ id: number }>("INSERT INTO customers(user_id) VALUES($1) RETURNING id", [userId])).rows[0].id));
    const request = (customerId: number, barberId: number, time: string) => createBooking(pool, { customerId, barberId, serviceId, date, time });
    const race = await Promise.allSettled([request(customers[0], barbers[0], "10:00"), request(customers[1], barbers[0], "10:00")]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1, race.map((result) => result.status === "rejected" ? String(result.reason) : "success").join("; "));
    assert.equal(race.filter((result) => result.status === "rejected" && result.reason instanceof BookingServiceError && result.reason.kind === "conflict").length, 1);
    const winner = (race.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<{ customerId: number }>).value;
    const loser = customers.find((id) => id !== winner.customerId)!;
    await assert.rejects(request(loser, barbers[0], "09:45"), { kind: "conflict" });
    await assert.rejects(request(loser, barbers[0], "10:15"), { kind: "conflict" });
    await assert.rejects(request(loser, barbers[0], "09:30"), { kind: "conflict" });
    await assert.rejects(createBooking(pool, { customerId: loser, barberId: barbers[0], serviceId: longServiceId, date, time: "09:15" }), { kind: "conflict" });
    await assert.rejects(request(winner.customerId, barbers[1], "10:15"), { kind: "conflict" });
    const adjacent = await request(loser, barbers[0], "10:45");
    assert.equal(adjacent.time, "10:45");
    const any = await createBooking(pool, { customerId: loser, serviceId, date, time: "10:00" });
    assert.notEqual(any.barberId, barbers[0]);
    await assert.rejects(createBooking(pool, { customerId: winner.customerId, serviceId, date, time: "10:15" }), { kind: "conflict" });
    await assert.rejects(createBooking(pool, { customerId: winner.customerId, serviceId, date, time: "19:15" }), { kind: "conflict" });
    const direct = (customerId: number, index: number) => pool.query(
      `INSERT INTO bookings(customer_id,barber_id,service_id,service_name,service_price,service_duration_minutes,booking_date,booking_time,end_time)
       VALUES($1,$2,$3,'Concurrency cut',100,45,$4,$5,$6)`,
      [customerId, barbers[0], serviceId, date, index ? "12:15" : "12:00", index ? "13:00" : "12:45"],
    );
    const databaseRace = await Promise.allSettled(customers.map(direct));
    assert.equal(databaseRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(databaseRace.filter((result) => result.status === "rejected" && result.reason.code === "23P01").length, 1);
  } finally {
    await pool.query("DELETE FROM bookings WHERE service_id=ANY($1::text[])", [[serviceId, longServiceId]]);
    await pool.query("DELETE FROM customers WHERE user_id=ANY($1::int[])", [users]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [users]);
    await pool.query("DELETE FROM barbers WHERE id=ANY($1::int[])", [barbers]);
    await pool.query("DELETE FROM services WHERE id=$1", [serviceId]);
    await pool.query("DELETE FROM services WHERE id=$1", [longServiceId]);
    await pool.end();
  }
});
