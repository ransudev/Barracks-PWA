import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { pool } from "../server/db/pool";
import { mutatePayroll, readPayroll, periodContaining } from "../server/services/payroll.service";
import { payrollCommandSchema, payrollQuerySchema } from "../server/schemas/payroll.schema";

// Explicit demo-only command: additive fixtures, not a production payroll initializer.
const client = await pool.connect();
type Actor = { id: number; role: "manager" | "front_desk" };
const unchangedTables = ["users", "customers", "suppliers", "supplier_accounts", "transactions", "transaction_payments", "transaction_financial_actions",
  "barber_attendance", "barber_attendance_corrections", "inventory_items", "inventory_movements",
  "restock_requests", "restock_request_items", "payroll_records", "payroll_payments", "payroll_snapshot_corrections"];
const snapshots = new Map<string, { ids: string[]; digest: string }>();

async function preserveExisting(db: PoolClient) {
  for (const table of unchangedTables) {
    const row = (await db.query<{ ids: string[]; digest: string }>(
      `SELECT COALESCE(array_agg(id::text ORDER BY id),'{}') AS ids,
        md5(COALESCE(string_agg(to_jsonb(t)::text,'|' ORDER BY id),'')) AS digest FROM ${table} t`,
    )).rows[0];
    snapshots.set(table, row);
  }
}

async function verifyPreservation(db: PoolClient) {
  for (const [table, before] of snapshots) {
    const after = (await db.query<{ count: number; digest: string }>(
      `SELECT count(*)::int AS count,md5(COALESCE(string_agg(to_jsonb(t)::text,'|' ORDER BY id),'')) AS digest
       FROM ${table} t WHERE id::text=ANY($1::text[])`, [before.ids],
    )).rows[0];
    if (after.count !== before.ids.length || after.digest !== before.digest) {
      throw new Error(`Existing ${table} records changed; rolling back the whole demo refresh`);
    }
  }
}

try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SELECT pg_advisory_xact_lock(20261003,1)");
  const migrated = (await client.query("SELECT 1 FROM schema_migrations WHERE name='028_barber_payroll.sql'")).rowCount;
  if (!migrated) throw new Error("Apply migration 028 before seeding the working app");
  const actors = (await client.query<Actor & { email: string }>(
    `SELECT u.id,r.name AS role,u.email FROM users u JOIN roles r ON r.id=u.role_id
     WHERE u.email IN ('demo.manager@barracks.app','demo.frontdesk@barracks.app')
       AND u.deleted_at IS NULL AND u.is_verified AND NOT u.is_blocked`,
  )).rows;
  const manager = actors.find((a) => a.email === "demo.manager@barracks.app" && a.role === "manager");
  const cashier = actors.find((a) => a.email === "demo.frontdesk@barracks.app" && a.role === "front_desk");
  if (!manager || !cashier) throw new Error("Verified demo Manager and Front Desk accounts are required");
  const branches = (await client.query<{ id: number; name: string; code: string }>(
    `SELECT id,name,code FROM branches WHERE status='active' AND (code='MAIN' OR name IN
     ('Barracks Bajada HQ','Barracks Lanang HQ','Barracks Bangkal HQ','Barracks Maa HQ')) ORDER BY id`,
  )).rows;
  if (branches.length !== 5) throw new Error("The five original demo branches are required");
  for (const branch of branches) {
    const access = (await client.query(
      "SELECT user_id FROM user_branches WHERE branch_id=$1 AND user_id=ANY($2::int[])",
      [branch.id, [manager.id, cashier.id]],
    )).rowCount;
    if (access !== 2) throw new Error(`Demo staff need explicit membership in ${branch.name}`);
  }
  // payroll_settings uses branch_id rather than id; snapshot it separately.
  const calendarBefore = (await client.query("SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,'|' ORDER BY branch_id),'')) digest,COALESCE(array_agg(branch_id),'{}') ids FROM payroll_settings t")).rows[0];
  await preserveExisting(client);
  await client.query(await readFile(new URL("./refresh-demo.sql", import.meta.url), "utf8"));
  console.log("Existing demo stock/restocks refreshed; preparing all five branches.");
  await client.query(await readFile(new URL("./working-app.sql", import.meta.url), "utf8"));
  // Flush completion/tender constraints before generating payroll.
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  await client.query("SET CONSTRAINTS ALL DEFERRED");

  // Only documented synthetic sources receive fixture-rate evidence. Unmarked
  // real services remain unresolved, and existing corrections are never replaced.
  const corrected = await client.query(
    `INSERT INTO payroll_snapshot_corrections(snapshot_id,rate,reason,approved_by)
     SELECT s.id,CASE WHEN b.first_name='Miko' AND b.last_name='Reyes' THEN 45
       WHEN b.first_name='Paolo' AND b.last_name='Santos' THEN 50
       WHEN b.first_name='Andrei' AND b.last_name='Villanueva' THEN 55
       ELSE b.commission_rate END,
       'DEMO ONLY: synthetic service; percentage comes from the documented demo fixture, not evidence of a real employment agreement.',$1
     FROM payroll_service_snapshots s JOIN barbers b ON b.id=s.barber_id
     LEFT JOIN bookings bk ON bk.id=s.booking_id LEFT JOIN queue_entries q ON q.id=s.queue_entry_id
     WHERE s.rate_snapshot IS NULL AND NOT EXISTS(SELECT 1 FROM payroll_snapshot_corrections c WHERE c.snapshot_id=s.id)
       AND (((q.idempotency_fingerprint LIKE 'demo-app-history-%' OR q.idempotency_fingerprint LIKE 'demo-app-queue-%') AND q.customer_id IN
          (SELECT id FROM customers WHERE user_id IS NULL AND phone LIKE '+63 917 556 %'))
       OR ((bk.demo_key LIKE 'demo-working-%' OR bk.demo_key='demo-samira-premium')
         AND (b.first_name,b.last_name) IN (('Miko','Reyes'),('Paolo','Santos'),('Andrei','Villanueva'))))
     RETURNING snapshot_id`, [manager.id],
  );
  await client.query(`DO $$ DECLARE tx RECORD; BEGIN FOR tx IN
    SELECT t.id FROM transactions t JOIN payroll_service_snapshots s
      ON s.visit_type=t.visit_type AND s.visit_record_id=t.visit_record_id
    JOIN payroll_snapshot_corrections c ON c.snapshot_id=s.id
    WHERE c.reason LIKE 'DEMO ONLY:%' AND NOT EXISTS(SELECT 1 FROM barber_commission_entries e WHERE e.source_transaction_id=t.id)
    LOOP PERFORM accrue_payroll_commission(tx.id); END LOOP; END $$;`);
  const today = (await client.query("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Manila')::date::text today")).rows[0].today as string;
  const defaultAnchor = new Date(Date.parse(`${today}T00:00:00Z`) - 35 * 86400000).toISOString().slice(0, 10);
  const command = async (branchId: number, input: Record<string, unknown>) =>
    mutatePayroll(client, manager, payrollCommandSchema.parse({ ...input, branchId }));

  for (const branch of branches) {
    let setting = (await client.query("SELECT anchor_date::text FROM payroll_settings WHERE branch_id=$1", [branch.id])).rows[0];
    if (!setting) {
      await command(branch.id, { action: "configure", anchorDate: defaultAnchor });
      setting = { anchor_date: defaultAnchor };
    }
    // Seed two closed periods. Existing records/staff progress are immutable to
    // this script; only records created by this invocation are transitioned.
    for (let periodIndex = 0; periodIndex < 2; periodIndex++) {
      const start = new Date(Date.parse(`${setting.anchor_date}T00:00:00Z`) + periodIndex * 14 * 86400000).toISOString().slice(0, 10);
      const period = periodContaining(setting.anchor_date, start)!;
      if (period.end > today) continue;
      const previous = new Set((await client.query<{ id: string }>(
        "SELECT id FROM payroll_records WHERE branch_id=$1", [branch.id],
      )).rows.map((r) => r.id));
      // Seed drafts in bulk with the same constraints/audit trail as generate.
      // The fixture filter prevents absorbing any actual commission entries.
      await client.query(`INSERT INTO payroll_periods(branch_id,period_start,period_end_exclusive)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [branch.id, period.start, period.end]);
      await client.query(`INSERT INTO payroll_records(payroll_period_id,branch_id,barber_id,barber_name,branch_name)
        SELECT DISTINCT p.id,p.branch_id,e.barber_id,concat_ws(' ',b.first_name,b.last_name),br.name
        FROM barber_commission_entries e JOIN barbers b ON b.id=e.barber_id JOIN branches br ON br.id=e.branch_id
        JOIN payroll_periods p ON p.branch_id=e.branch_id AND p.period_start=$2
        JOIN transactions t ON t.id=e.source_transaction_id LEFT JOIN bookings bk ON bk.id=t.booking_id
        LEFT JOIN queue_entries q ON q.id=t.queue_entry_id
        WHERE e.branch_id=$1 AND e.earned_at>=($2::date::timestamp AT TIME ZONE 'Asia/Manila')
          AND e.earned_at<($3::date::timestamp AT TIME ZONE 'Asia/Manila')
          AND (q.idempotency_fingerprint LIKE 'demo-app-history-%' OR bk.demo_key LIKE 'demo-working-%' OR bk.demo_key='demo-samira-premium')
          AND NOT EXISTS(SELECT 1 FROM payroll_record_entries x WHERE x.commission_entry_id=e.id)
          AND NOT EXISTS(SELECT 1 FROM payroll_records r WHERE r.payroll_period_id=p.id AND r.barber_id=e.barber_id)
        ON CONFLICT DO NOTHING`, [branch.id, period.start, period.end]);
      const fresh = (await client.query<{ id: string; barber_id: number }>(
        "SELECT r.id,r.barber_id FROM payroll_records r JOIN payroll_periods p ON p.id=r.payroll_period_id WHERE r.branch_id=$1 AND p.period_start=$2 ORDER BY r.barber_id",
        [branch.id, period.start],
      )).rows.filter((r) => !previous.has(r.id));
      for (const [index, record] of fresh.entries()) {
        await client.query(`INSERT INTO payroll_record_entries(payroll_record_id,commission_entry_id)
          SELECT $1,e.id FROM barber_commission_entries e JOIN transactions t ON t.id=e.source_transaction_id
          LEFT JOIN bookings bk ON bk.id=t.booking_id LEFT JOIN queue_entries q ON q.id=t.queue_entry_id
          WHERE e.branch_id=$2 AND e.barber_id=$3 AND e.earned_at>=($4::date::timestamp AT TIME ZONE 'Asia/Manila')
            AND e.earned_at<($5::date::timestamp AT TIME ZONE 'Asia/Manila')
            AND (q.idempotency_fingerprint LIKE 'demo-app-history-%' OR bk.demo_key LIKE 'demo-working-%' OR bk.demo_key='demo-samira-premium')
            AND NOT EXISTS(SELECT 1 FROM payroll_record_entries x WHERE x.commission_entry_id=e.id)
          ON CONFLICT DO NOTHING`, [record.id, branch.id, record.barber_id, period.start, period.end]);
        await client.query(`UPDATE payroll_records SET gross_centavos=v.total,payable_centavos=v.total,updated_at=clock_timestamp()
          FROM (SELECT COALESCE(sum(e.amount_centavos),0) total FROM payroll_record_entries x
            JOIN barber_commission_entries e ON e.id=x.commission_entry_id WHERE x.payroll_record_id=$1) v WHERE id=$1`, [record.id]);
        await client.query("INSERT INTO payroll_audit_events(payroll_record_id,actor_id,action,reason) VALUES($1,$2,'generate',$3)",
          [record.id, manager.id, "DEMO ONLY: synthetic payroll walkthrough; no real wages or funds."]);
        if (periodIndex === 1 && index % 3 === 0) continue; // Draft to edit.
        await command(branch.id, { action: "submit", recordId: Number(record.id) });
        if (periodIndex === 1 && index % 3 === 1) continue; // Pending to approve.
        await command(branch.id, { action: "approve", recordId: Number(record.id) });
        if (periodIndex === 1) continue; // Approved to record external payment.
        await command(branch.id, { action: "pay", recordId: Number(record.id), paidAt: new Date().toISOString(),
          paymentMethod: "bank_transfer", reference: `DEMO-ONLY-NO-FUNDS-${branch.code}-${period.start}-${record.barber_id}` });
      }
    }
    const overview = await readPayroll(client, manager, payrollQuerySchema.parse({ branchId: branch.id }));
    if (!("summary" in overview)) throw new Error("Expected a payroll overview");
    console.log(JSON.stringify({ branch: branch.name, payroll: overview.summary, currentEarners: overview.currentEarnings?.length ?? 0 }));
  }
  const calendarAfter = (await client.query("SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,'|' ORDER BY branch_id),'')) digest FROM payroll_settings t WHERE branch_id=ANY($1::int[])", [calendarBefore.ids])).rows[0];
  if (calendarAfter.digest !== calendarBefore.digest) throw new Error("An existing calendar was changed");
  await verifyPreservation(client);
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  await client.query("COMMIT");
  console.log(`Working demo committed. ${corrected.rowCount} synthetic historical rates confirmed; existing accounts, money records, stock, attendance, and payroll preserved. DEMO payroll payments do not represent real disbursements.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Working demo seed rolled back", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
