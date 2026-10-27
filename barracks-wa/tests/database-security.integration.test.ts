import assert from "node:assert/strict";
import test from "node:test";
import { applyMigrations } from "@/server/db/migrate";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("internal access migration preserves history/backend and denies API objects/defaults", { skip: !databaseConfigured }, async () => {
  const { db, schema, cleanup } = await createDisposableSchema(28);
  const client = await db.connect();
  try {
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='readiness_backend') THEN CREATE ROLE readiness_backend NOLOGIN BYPASSRLS; END IF;
    END $$`);
    await client.query(`CREATE TABLE protected_fixture(id BIGSERIAL PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO protected_fixture(value) VALUES ('retained');
      CREATE VIEW protected_fixture_view AS SELECT * FROM protected_fixture;
      CREATE FUNCTION protected_read() RETURNS TEXT LANGUAGE SQL SECURITY DEFINER
        SET search_path=${schema},pg_temp AS 'SELECT value FROM protected_fixture LIMIT 1';
      GRANT USAGE ON SCHEMA "${schema}" TO anon,authenticated,readiness_backend;
      GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO anon,authenticated,readiness_backend;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA "${schema}" TO anon,authenticated,readiness_backend;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "${schema}" TO anon,authenticated,readiness_backend;
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON TABLES TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON SEQUENCES TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON FUNCTIONS TO anon,authenticated;`);
    // Reproduce equivalent access through a definer function before containment.
    await client.query("SET ROLE anon");
    assert.equal((await client.query(`SELECT "${schema}".protected_read() AS value`)).rows[0].value, "retained");
    await client.query("RESET ROLE");
    const before = await client.query("SELECT id,value FROM protected_fixture");
    const inventory = await client.query(`SELECT c.relkind,count(*)::int AS count FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
      AND c.relkind IN ('r','p','v','m','S','f') GROUP BY c.relkind ORDER BY c.relkind`, [schema]);
    const routines = await client.query(`SELECT count(*)::int AS count FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`, [schema]);
    console.log("Internal fixture inventory", inventory.rows, "routines", routines.rows[0].count);
    await applyMigrations(db, 29);
    assert.deepEqual((await client.query("SELECT id,value FROM protected_fixture")).rows, before.rows);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, 29);
    await client.query(`CREATE TABLE future_fixture(id BIGSERIAL PRIMARY KEY);
      CREATE VIEW future_fixture_view AS SELECT * FROM future_fixture;
      CREATE FUNCTION future_read() RETURNS INT LANGUAGE SQL AS 'SELECT 1';`);

    for (const role of ["anon", "authenticated"]) {
      const tableRights = await client.query(`SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
        AND c.relkind IN ('r','p','v','m') AND (has_table_privilege($2,c.oid,'SELECT')
          OR has_table_privilege($2,c.oid,'INSERT') OR has_table_privilege($2,c.oid,'UPDATE')
          OR has_table_privilege($2,c.oid,'DELETE') OR has_table_privilege($2,c.oid,'TRUNCATE'))`, [schema, role]);
      assert.deepEqual(tableRights.rows, [], `${role} has no table/view grants`);
      const sequenceRights = await client.query(`SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='S'
        AND (has_sequence_privilege($2,c.oid,'USAGE') OR has_sequence_privilege($2,c.oid,'SELECT')
          OR has_sequence_privilege($2,c.oid,'UPDATE'))`, [schema, role]);
      assert.deepEqual(sequenceRights.rows, []);
      const functionRights = await client.query(`SELECT p.proname FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
        AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
        AND has_function_privilege($2,p.oid,'EXECUTE')`, [schema, role]);
      assert.deepEqual(functionRights.rows, []);
      assert.equal((await client.query("SELECT has_schema_privilege($1,$2,'USAGE') AS allowed", [role, schema])).rows[0].allowed, false);
      // Restore only schema lookup in this disposable fixture to prove object
      // denial independently of the extra schema boundary.
      await client.query(`GRANT USAGE ON SCHEMA "${schema}" TO ${role}`);
      await client.query(`SET ROLE ${role}`);
      for (const sql of ["SELECT * FROM protected_fixture", "SELECT * FROM protected_fixture_view",
        "INSERT INTO protected_fixture(value) VALUES ('denied')", "SELECT nextval('protected_fixture_id_seq')",
        "SELECT protected_read()", "SELECT accrue_payroll_commission(0)", "SELECT future_read()",
        "SELECT * FROM future_fixture", "SELECT * FROM future_fixture_view"]) {
        await assert.rejects(client.query(sql), (error: unknown) => (error as { code?: string }).code === "42501", sql);
      }
      await client.query("RESET ROLE");
      await client.query(`REVOKE USAGE ON SCHEMA "${schema}" FROM ${role}`);
    }
    const unprotected = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND NOT c.relrowsecurity AND c.relname<>'future_fixture'`, [schema]);
    assert.deepEqual(unprotected.rows, []);
    await client.query("SET ROLE readiness_backend");
    assert.equal((await client.query("SELECT value FROM protected_fixture")).rows[0].value, "retained");
    await client.query("INSERT INTO protected_fixture(value) VALUES ('backend-write'); SELECT protected_read(); SELECT accrue_payroll_commission(0)");
    await client.query("RESET ROLE");
    // Running through the existing migration ledger again is idempotent.
    await applyMigrations(db, 29);
  } finally {
    await client.query("RESET ROLE");
    client.release();
    await cleanup();
  }
  const fresh = await createDisposableSchema(29);
  try {
    assert.equal((await fresh.db.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, 29);
    assert.equal((await fresh.db.query("SELECT has_table_privilege('anon','users','SELECT') AS allowed")).rows[0].allowed, false);
  } finally { await fresh.cleanup(); }
});

test("security migration rolls back when API roles inherit an unexpected grant", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema(28);
  try {
    await db.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='readiness_inherited') THEN CREATE ROLE readiness_inherited NOLOGIN; END IF;
    END $$;
      GRANT SELECT ON users TO readiness_inherited;
      GRANT readiness_inherited TO anon;`);
    await assert.rejects(applyMigrations(db, 29), /retains inherited\/elevated internal access/);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM schema_migrations")).rows[0].count, 28);
    await db.query("REVOKE readiness_inherited FROM anon");
    await applyMigrations(db, 29);
    assert.equal((await db.query("SELECT has_table_privilege('anon','users','SELECT') AS allowed")).rows[0].allowed, false);
  } finally {
    await db.query("REVOKE readiness_inherited FROM anon");
    await cleanup();
  }
});
