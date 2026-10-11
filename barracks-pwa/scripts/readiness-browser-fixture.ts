// Disposable local browser acceptance only. Never run against hosted data.
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyMigrations } from "../server/db/migrate";
import { hashPassword } from "../server/services/password.service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Disposable DATABASE_URL required");
const target = new URL(connectionString);
if (target.hostname !== "127.0.0.1" || !/^\/barracks_[a-z0-9_]*disposable$/.test(target.pathname) || process.env.DATABASE_SSL === "true")
  throw new Error("Browser fixture requires a loopback barracks_*disposable database");
const db = new Pool({ connectionString });
try {
  await applyMigrations(db);
  const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
  const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Readiness Second','READY2') ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0].id);
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  const users: Record<string, string> = {};
  for (const [key, role, branches] of [["desk", "front_desk", [main, second]], ["manager", "manager", [main]], ["local", "front_desk", [main]], ["foreign", "front_desk", [second]], ["shared", "front_desk", [main, second]], ["unassigned", "front_desk", []]] as const) {
    const email = `readiness.${key}@test.local`;
    const id = Number((await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id,is_verified)
      VALUES($1,'Fixture',$2,$3,(SELECT id FROM roles WHERE name=$4),true)
      ON CONFLICT ((LOWER(email))) WHERE deleted_at IS NULL DO UPDATE SET password_hash=EXCLUDED.password_hash,is_verified=true RETURNING id`, [key, email, passwordHash, role])).rows[0].id);
    for (const branch of branches) await db.query("INSERT INTO user_branches(user_id,branch_id,is_primary) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [id, branch, branch === branches[0]]);
    users[key] = email;
  }
  await db.query("UPDATE shop_operating_hours SET open_time='00:00',close_time='23:59',is_closed=false");
  for (const [name, branch] of [["Main", main], ["Second", second]] as const) {
    const barber = Number((await db.query("INSERT INTO barbers(first_name,last_name,branch_id) VALUES($1,'Readiness',$2) RETURNING id", [name, branch])).rows[0].id);
    await db.query("INSERT INTO barber_schedules(barber_id,day_of_week,start_time,end_time) SELECT $1,day,'00:00','23:59' FROM generate_series(0,6) AS day", [barber]);
  }
  const credentialsPath = join(tmpdir(), "barracks-readiness-browser-credentials.json");
  await writeFile(credentialsPath, JSON.stringify({ password, users, main, second }), { mode: 0o600 });
  console.log("Disposable browser fixture ready; credentials remain in local temporary file. Branches:", main, second);
} finally { await db.end(); }
