# Local database security evidence

Date: 2026-10-11, Asia/Manila. Scope: local T003/T004/T006–T009, FR-001/FR-002, local SC-001. Hosted acceptance remains unchecked.

## Target isolation (T004)

Initialized a new PostgreSQL 17 cluster with the existing installed binaries at `C:/Program Files/PostgreSQL/17/bin`; no package or hosted infrastructure was installed/changed. Cluster directory: `%TEMP%/barracks-readiness-pg-20261011`. Listener: `127.0.0.1:55439`. Database: `barracks_readiness_disposable`. Owner: `barracks_test_owner`. Loopback-only trust authentication is used solely for this disposable local cluster. The already running Windows PostgreSQL service was not reconfigured.

Tests explicitly set `DATABASE_URL=postgresql://barracks_test_owner@127.0.0.1:55439/barracks_readiness_disposable`, `DATABASE_SSL=false`, and empty `POSTGRES_URL`. The shared disposable-schema helper now rejects non-loopback hosts, database names outside `barracks_*disposable`, and `DATABASE_SSL=true` before opening a pool or issuing CREATE/DROP. No integration test was pointed at Supabase/production. Generated test schemas are dropped by the helper; synthetic API/backend test roles remain in this isolated cluster.

To stop the temporary cluster after acceptance/browser work: use the installed `pg_ctl.exe -D "$env:TEMP/barracks-readiness-pg-20261011" stop`. Do not stop the unrelated Windows service. Reinitialization is unnecessary while this cluster exists.

## Inventory and baseline (T003)

Inspected migration runner, migrations 001–028, `server/db/pool.ts`, test helper, package dependencies, and source searches for Supabase clients and database access. The app uses server-side `pg` and its own sessions; no direct Supabase SDK client was found. External integrations and actual hosted exposure remain unverified. Payroll 028 already enabled payroll RLS and revoked direct anon/authenticated table grants, but left general objects, callable routines, schema access and future defaults outside that containment.

In the existing-baseline security fixture (001–028 plus synthetic table/view/definer function), PostgreSQL inventory counted 40 tables including the migration ledger and fixture, 35 sequences, 1 view, and 36 non-extension routines. The baseline API role successfully invoked a SECURITY DEFINER fixture function returning protected table data before applying 029, reproducing function-mediated exposure safely. Extension-owned btree_gist routines were explicitly identified/excluded from internal-object ACL mutation; they do not read Barracks tables. Hosted extension functions and other exposed schemas still require the rollout inventory.

## Migration and meaningful checks (T006–T008)

Prepared `029_internal_database_access.sql`. It enables RLS on existing internal tables, revokes schema rights and table/sequence/view/routine privileges from PUBLIC/anon/authenticated, preserves explicit backend grants and backend owner schema usage, and secures future creator defaults. It handles PostgreSQL’s global PUBLIC EXECUTE function default explicitly. It fails transactionally if API roles retain elevated/inherited internal rights. It retains all payroll triggers/deny rules and does not rewrite operational rows.

Executed from `barracks-pwa`:

```powershell
$env:DATABASE_URL='postgresql://barracks_test_owner@127.0.0.1:55439/barracks_readiness_disposable'
$env:DATABASE_SSL='false'
$env:POSTGRES_URL=''
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/database-security.integration.test.ts
```

Latest result: **2 passed, 0 failed, 0 skipped**. Coverage includes:

- Migration from existing 028 schema and from empty schema through 029; ledger repeat execution is idempotent.
- Effective denied table/view reads and writes, sequence use, general/SECURITY DEFINER/payroll function execution for real anon and authenticated roles, including after restoring schema lookup alone to test the object boundary.
- New table/sequence/view/function defaults deny API rights after migration; all existing internal tables have RLS enabled.
- A nonsuperuser backend role with pre-existing explicit grants and BYPASSRLS can read/write retained fixture rows and invoke functions after containment; the owner also retains access.
- A saved operational fixture’s rows match before/after. Unexpected inherited SELECT privilege produces a migration error with ledger still at 028; removing the unexpected role grant permits the migration.

An intermediate run failed because dependency replacement temporarily removed tsx; this was a harness/install concurrency failure. Rerun after install completed passed. An earlier test adjustment excluded extension-owned routines from the internal function assertion, matching the documented migration boundary. Full payroll/booking/payment/restock workflow verification belongs to the parent’s Stage 5 suite; this narrow security test does not claim those workflows passed.

## Rollout package and blockers (T009)

[`security-rollout.md`](security-rollout.md) contains read-only identity/owner/ACL/default-policy queries, preservation steps, backend role prerequisites, exact-target authorization gates, HTTP Data API denial verification, and secure forward-fix/recovery instructions. [`security-preservation.sql`](security-preservation.sql) provides aggregate row fingerprints without emitting source records.

Pending: exact hosted project/backend identity, effective hosted grants and exposed-schema/extension/integration inventory, staging/live HTTP denial for both anon and authenticated tokens, backend hosted workflow validation, preservation comparison for the named hosted target, and isolated backup restoration/D06. No hosted migration, exposure setting change, deployment, push or merge was performed by this workstream. Local SQL denial is not evidence of PostgREST HTTP denial or production readiness.
