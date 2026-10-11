# Database containment rollout package

Status: prepared locally on 2026-10-11, Asia/Manila. No hosted changes authorized or applied. T009 is the review package; live SC-001/SC-008 remain pending.

## Candidate and boundaries

Candidate application source is `523a97f`; test-only follow-up `b1b3751`. The normal `db:migrate` runner applies both `029_internal_database_access.sql` and `030_visit_duration.sql` after 001–028. Apply only after approval for the exact project/database and release. The audit identified intended hosted project `barracksbarbers` (`gngepbytysjztnrsbotn`); this identity, live ledger, exposed schemas and actual backend role have not been reverified during local implementation. Record the project ID, database identity, backend login, candidate commit, exposed schemas, and last migration before requesting that action. The local verification target is `127.0.0.1:55439/barracks_readiness_disposable`; it is a separately initialized PostgreSQL 17 cluster, never the hosted application database.

Migration 029 changes schema/object ACLs, table RLS flags, and creator defaults. It changes no operational rows, columns, relationships, triggers, or payroll rules. It retains explicit authorized backend grants and the migration/backend owner’s schema access. Internal tables, partitioned tables, sequences, views/materialized views, foreign tables, functions and procedures are covered. Extension-owned objects are deliberately left under their extension’s permissions: inventory and inspect those separately, including whether any exposes application data. Other exposed schemas also need their own review. Revoking PUBLIC function defaults is global for each inventoried creator because a schema-local REVOKE cannot subtract PostgreSQL’s global PUBLIC EXECUTE default; review the creator’s other schemas before applying.

The server must connect as table owner or a reviewed role with BYPASSRLS and its explicit required grants. This migration does not grant BYPASSRLS, transfer ownership, invent browser policies, or authorize a new privileged backend. API roles with elevated/inherited rights cause migration failure and transaction rollback. Adding a new object-creator role later requires securing its defaults before it creates objects. Extension installation and future explicit GRANT statements still require review.

## Read-only preflight

Run in the exact candidate database before approval; retain metadata privately and never print credentials, user rows, password hashes, session tokens, or keys.

```sql
SELECT current_database(), current_user, current_schema(), version();
SELECT name, applied_at FROM schema_migrations ORDER BY name;
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles WHERE rolname IN (current_user,'anon','authenticated','service_role');
SELECT pg_get_userbyid(roleid) AS granted_role, pg_get_userbyid(member) AS member
FROM pg_auth_members ORDER BY 1,2;
SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f') ORDER BY 2;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
       pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl,
       EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
         AND d.objid=p.oid AND d.deptype='e') AS extension_owned
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY 2,3;
SELECT pg_get_userbyid(defaclrole),defaclnamespace::regnamespace,defaclobjtype,defaclacl
FROM pg_default_acl;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies;
SELECT nspname,nspacl FROM pg_namespace WHERE nspname NOT LIKE 'pg_%';
```

Confirm actual Supabase Data API exposed schemas in its settings and every direct client/integration. Repository search found the application uses `pg` on the server and its own cookie sessions; no direct Supabase SDK integration was found. This source observation does not prove the absence of external integrations. Inventory object owners and whether the migration runner can alter every owner’s defaults. Verify backend owner/BYPASSRLS and explicit schema/table/sequence/function rights before proceeding. Do not infer effective denial from RLS flags or ACL strings alone.

## Preservation before and after

Take a supported backup/snapshot first under the approved recovery procedure. Run this fingerprint query in a quiet maintenance window before and after. Save only its aggregate results in a private release artifact; it never returns operational rows. Compare every table except the intentionally advanced migration ledger. A concurrently changing dataset requires a defined snapshot/window rather than asserting equal live fingerprints.

Use the executable aggregate query in [`security-preservation.sql`](security-preservation.sql). It returns table names, counts, and aggregate digests; compare the saved before/after outputs.

## Apply and verify after named-target authorization

1. Reconfirm database identity, candidate commit, migration order, exposure/integration inventory, backup, preservation aggregates, and the backend privilege preflight.
2. Run the normal migration runner with that database’s securely configured environment. Each pending migration runs transactionally with its ledger insertion; do not describe the normal runner as applying only 029. Record the resulting ledger and inspect effective object permissions plus default ACLs.
3. Verify backend login directly and complete authorized application reads/writes, booking/service completion/payment, payroll approval/payment and restock receipt against disposable staging fixtures. Confirm payroll immutability remains enforced.
4. For both the anon key and a real authenticated Supabase user JWT, perform HTTP Data API GET requests to each internal table/view, sequence-mediated insert probes using disposable fixtures, and RPC calls for every inventoried callable internal routine (including `accrue_payroll_commission`). Record denial status, non-sensitive error code and absence of rows/mutations. Do not use a service-role key to represent an unauthenticated/authenticated client. Unknown routes or zero-row RLS responses alone do not prove all write/function cases.
5. Confirm neither role effectively has SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on internal tables/views, USAGE/SELECT/UPDATE on sequences, or EXECUTE on internal routines. Inspect inherited role grants. In isolated staging only, create/drop a future table/sequence/view/function as each approved creator and verify denied API access.
6. Compare preservation aggregates, source migration identity and application smoke checks. Record the exact release/environment and request sign-off only for checks actually executed.

## Failure and recovery

An execution error rolls the migration and ledger entry back together. Resolve unexpected owner/default-ACL/inherited-grant configuration in an isolated candidate before an authorized retry. If containment succeeds but a backend operation fails, keep browser denial in place and use a reviewed forward migration granting only the named backend identity’s missing rights or restoring its intended owner configuration. Do not restore PUBLIC, anon, or authenticated internal grants, disable containment automatically, or erase the migration ledger to manufacture a rollback. If restoring a backup is necessary, restore into an isolated target, reapply containment, and validate operational/payroll invariants before routing traffic. Recovery targets and restore proof still depend on D06/stages 6–7.


## Migration 030 preflight and compatibility

030 adds immutable queue duration snapshots and ordered barber-row locking for reservation writes. New visits snapshot catalog duration; appointment visits use booking snapshots. Historical walk-ins without recoverable durations remain NULL and cannot start until resolved through an explicit evidence-supported policy. Do not fill them with guessed current catalog durations. Before rollout, count unresolved nonterminal walk-ins and review active-service duration coverage; schedule operational handling and verify affected UI conflict behavior in staging. Existing booking duration snapshots are copied without changing financial, price or payroll snapshots. Reservation writes reject overlap with another active service; the current appointment excludes its own reservation when starting. Verify inserts, updates, deletes, reassignment and concurrency after applying. Recover through a reviewed forward fix while retaining containment and immutable snapshots.
