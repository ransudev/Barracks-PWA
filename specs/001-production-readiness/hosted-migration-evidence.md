# Hosted migrations 029–030

E07; authorized by the owner's “Do the migrations” request after merge/push. Applied 2026-10-12, approximately 06:32 Asia/Manila, to Supabase `barracksbarbers`, project `gngepbytysjztnrsbotn`, PostgreSQL 17.6. Candidate source: pushed merge `43dc765`. Database `postgres`, application connection role `postgres` (not superuser, BYPASSRLS, owner of application objects). Preflight ledger contained exactly 001–028.

A private custom-format public-schema backup was taken before changes, using the existing PostgreSQL 17 client and the project's session pooler. Its archive listing was readable (645 entries). Backup and aggregate fingerprints remain outside Git under `C:/Users/Lance/.codex/private-backups/barracks-readiness-20261012/`. This is not a demonstrated isolated restore or a full Supabase Auth/Storage backup.

Both exact repository SQL migrations and application ledger insertions were executed in one transaction, using advisory transaction lock 918274, a 15-second lock timeout, and locks on public tables preventing concurrent writes during preservation checks. This deliberately strengthened the normal runner's per-migration transactions so a failed preservation or denial check could roll back both together. The first attempt did roll back: the verification query evaluated a sequence-privilege predicate against an index. The verification query was corrected to evaluate privileges per object type; repository migration SQL was unchanged. The retry committed successfully at 2026-10-11T23:32:47Z. The normal `applyMigrations` runner was subsequently executed against the same backend connection and reported up to date.

| Verification | Result |
| --- | --- |
| Application migration ledger | Exactly 001–030; 029 and 030 recorded |
| Preservation | 38 operational-table counts/digests matched; zero mismatch. Queue digest excluded only the intentionally added duration field; all old fields matched |
| Booking duration backfill | Zero mismatch against source booking snapshots |
| Internal RLS | 39/39 public tables protected, including migration ledger |
| Effective SQL privileges | Both anon/authenticated had no table/sequence rights across 73 objects and no EXECUTE on 38 internal routines |
| Actual SQL denial | Both roles received 42501 for zero-row SELECT and UPDATE probes; no operational data changed |
| Live Data API | Legacy anon key: all 39 public table GET probes with limit=0 denied, HTTP 401 / PostgreSQL 42501; no rows retrieved |
| Future defaults | Rolled-back table/sequence/view/function probes denied both roles; backend synthetic insert/read succeeded and was rolled back |
| Backend reads | Users, bookings, transactions and payroll read aggregates succeeded through the application's configured pool |

Historical unresolved walk-ins at rollout: 17 Waiting, 6 Ready, 4 In progress (27 total). These retain NULL duration; new starts fail closed. Existing services can still complete through the application's normal lifecycle. No guessed duration, status change, payment, payroll, inventory, membership, seed, or credential mutation was performed.

Security advisors no longer report disabled RLS. Remaining findings: 39 informational RLS-enabled/no-policy notices (intentional server-only access), 38 mutable-function-search-path warnings (35 existing plus three new trigger routines), and one existing public `btree_gist` extension warning. These were recorded without expanding this rollout into another hardening migration. Advisor references: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [public extension](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

Limits: authenticated-role SQL denial passed, but no real Supabase-authenticated JWT HTTP check was performed (the application uses its own sessions). Complete authenticated hosted application workflows, HTTP write/RPC probes, exposed-schema settings beyond tested public routes, deployment/runtime identity, P1 requirements, and isolated restore remain unverified. E07 does not satisfy the complete SC-001/SC-008 release gates or change the NOT READY production verdict. No new application deployment was initiated during this migration action.
