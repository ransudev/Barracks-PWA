# Evidence log

Status: Local P0 complete, 2026-10-11 Asia/Manila. Production verdict: NOT READY; required P1 and hosted acceptance remain pending.

## Prior audit baseline

Source: The full-system audit in this chat on 2026-10-11. These observations are dated audit evidence, not claims that a remediation passed. Recheck source versions, live state, and package advisories at execution time.

| Item | Audit observation | Limit |
| --- | --- | --- |
| Source | Branch `feature/barber-payroll`, commit `59502ac`; root `auditspec.md` untracked and pre-existing `barracks-pwa/AGENTS.md` modified | Working tree can change; reidentify before implementation |
| Verdict | NOT READY | Readiness assessment, not an implementation authorization |
| Database security | Live `barracksbarbers` project `gngepbytysjztnrsbotn`: 28 operational tables with disabled RLS and anonymous grants; no-row REST requests confirmed read access | No unauthorized writes or row contents retrieved |
| Payroll protection | 11 payroll tables protected; Data API access denied | Does not secure the other operational tables |
| Schema | Migrations 001-028 recorded live | Fresh migration compatibility was not exercised |
| Type/lint | Type checking passed; lint failed with 2 errors and 1 warning | Baseline only |
| Existing tests | 134 total: 69 passed, 17 failed, 48 skipped; DB URLs unset | Critical DB/concurrency behavior not executed; some UI failures were harness/assertion related |
| Dependencies | npm audit reported 1 critical and 9 high findings | Exposure/version/advisory state must be refreshed |
| Build/start | Scratch-copy webpack production build/start passed | Reused installed dependencies; no pristine install/default builder/hosted acceptance |
| Browser | Public landing desktop/mobile/tablet and mobile login/recovery dialog inspected | Authenticated operational workflows unverified |
| Integrity snapshot | Checked overlap/active-service, tender, branch, stock, commission, and payroll-total mismatches were zero | Snapshot consistency is not concurrency proof |
| Historical rate | One unresolved payroll rate snapshot observed | Remains an exception requiring Manager evidence; never infer a rate |
| Missing acceptance | Hosted release, clean migration, authenticated complete flows, isolated backup restore | Required applicable gates remain pending |

### Baseline findings index

| ID | Finding | Evidence category |
| --- | --- | --- |
| F01 | Operational Data API bypass | Live read/catalog confirmed |
| F02 | Manager staff actions lack target branch scope | Source confirmed; production mutations not attempted |
| F03 | Attendance not incorporated into operational availability | Source confirmed |
| F04 | Manual start lacks full interval check | Source plus isolated in-memory probe |
| F05 | Vulnerable dependencies | Audit/advisory evidence; no exploit attempted |
| F06 | Deactivated customers excluded from historical booking reads | Source confirmed; no affected live records found in sampled count |
| F07 | Public variants exceed supported operational prices/services | Source plus read-only catalog comparison |
| F08 | Discount workflow absent | Source/schema inspection |
| F09 | Customer recovery absent | Source plus public browser dialog |
| F10 | TLS certificate verification disabled by configuration | Source; interception not demonstrated |
| F11 | Regression acceptance incomplete | Executed commands plus explicit DB/browser gaps |
| F12 | General settings remain unrouted prototypes | Source; not an active false-save interaction |
| F13 | Health endpoint does not check DB readiness | Local runtime with unreachable DB target |

## Implementation entries

Use one compact entry per meaningful verification or phase. Evidence artifacts must omit credentials, tokens, password hashes, and unnecessary personal data.

| Evidence ID | Task / FR / SC | Commit and environment | Method / command | Expected / actual | Result | Artifact / limit |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | T001–T005 | Local branch codex/production-readiness, baseline 59502ac | Source/baseline inventory and owner decision | Separate disposable target; preserved AGENTS.md/auditspec.md; D01/D02 adopted | PASS | [local-baseline.md](local-baseline.md); external integrations/backend identity remain unverified |
| E02 | T006–T009, SC-001 local | Source 523a97f; isolated PostgreSQL 17 | Fresh/existing security migration and effective privilege/function/default-grant tests | 2/2 passed, zero skips; backend success and API denial; retained data unchanged | PASS | [security-evidence.md](security-evidence.md), [security-rollout.md](security-rollout.md); hosted denial NOT VERIFIED |
| E03 | T010–T012, SC-006 | Source 523a97f; local Windows Node 26.7.0 | Fresh isolated npm ci, audit, default build/lint/tsc | Production audit zero; five propagated dev-only high braces findings documented | PASS | [dependencies-evidence.md](dependencies-evidence.md), [final-build.log](final-build.log) |
| E04 | T013–T020, SC-002/003 | Source 523a97f; disposable schemas | Scoped staff/attendance/eligibility/transactional race tests | Actor/target changes serialize; immutable duration and authoritative post-lock start; overlapping starts/bookings denied | PASS | [staff-evidence.md](staff-evidence.md), [availability-ui-evidence.md](availability-ui-evidence.md), [final-tests.log](final-tests.log) |
| E05 | T021/T022, SC-004/005/006 local | Source 523a97f; disposable PostgreSQL only | npm test; npm run lint; npx tsc --noEmit; npm run build; npm start loopback | 154 tests, 154 pass, zero failures/skips; lint/type/default build/start passed | PASS | [final-tests.log](final-tests.log), [final-build.log](final-build.log); additional competing-stock proof recorded separately |
| E06 | T016/T019/T023/T024 | Source 523a97f; loopback production build, synthetic roles/branches | Authenticated Front Desk/Manager interactions, 19:58–20:15 Manila | Attendance counts, starts/denials/completions, clock-out, scoped staff, stale branch clearing and sampled keyboard/viewport checks passed | PASS | [browser-evidence.md](browser-evidence.md); full staging/all-role workflows pending |

Results: PASS, FAIL, BLOCKED, or NOT VERIFIED. Include date/time in Asia/Manila, role/branch/viewport for browser evidence, and actual test pass/fail/skip counts. State explicitly whether evidence is source-only, local runtime, browser, staging, or production.

## Decision log

| Decision | Confirmed policy and owner evidence | Date | Dependent tasks |
| --- | --- | --- | --- |
| D01 | Owner: "Adopt both draft policies"; overlapping reads, all target memberships required for global Manager mutations; atomic explicit branch creation | 2026-10-11 | T013-T016 |
| D02 | Owner: "Adopt both draft policies"; Unmarked eligible if other rules pass; absent/clocked-out block starts; active service blocks clock-out | 2026-10-11 | T017-T020 |
| D03 | Pending | - | T026 |
| D04 | Pending | - | T029 |
| D05 | Pending | - | T027-T028 |
| D06 | Pending | - | T031/T038 |

## Rollout and completion log

| Milestone | Exact environment/release | Authorization evidence where required | Verification | Status |
| --- | --- | --- | --- | --- |
| Local P0 | Branch codex/production-readiness, source 523a97f | User /goal request and D01/D02 adoption | E01–E06 | COMPLETE |
| Local P1 | Pending | Pending | Pending | NOT STARTED |
| Hosted database containment | Pending | Pending | Pending | NOT VERIFIED |
| Staging operational acceptance | Pending | Pending | Pending | NOT VERIFIED |
| Isolated restore | Pending | Pending | Pending | NOT VERIFIED |
| Production release | Pending | Pending | Pending | NOT READY |


## Final verification identity

Application implementation: `523a97f`. Final source candidate: `b1b3751` (adds only inventory concurrency tests; application source unchanged). The 154-case complete suite, default production build and authenticated browser checks ran on 523a97f. After the test-only addition, both new stock contention cases passed again on b1b3751 with zero skips; type checking also passed. Together 156 distinct cases executed successfully; this is 154 aggregate plus 2 focused cases, not a claimed new 156-case aggregate run. See [final-inventory-tests.log](final-inventory-tests.log). Targeted ESLint for the new test passed. No further application changes followed browser/build acceptance.

SC-005 contention: actual independent transactions were confirmed waiting on PostgreSQL locks before release. Double USE of 4 units from stock 5 produced one commit, one NEGATIVE_STOCK rejection, final stock 1 and one movement. Concurrent USE plus duplicate delivery receipt produced one receipt, final stock 6, nonnegative contiguous movement snapshots and correct branch ownership.

Remaining release blockers: P1 customer history/public pricing/discount/recovery/TLS/readiness work; D03–D06 owner decisions; named hosted migration/deployment authorization and live API/backend verification; complete staging operational acceptance; isolated backup restore and recovery targets. Legacy unknown walk-in duration is fail-closed, not guessed. The documented dev-only braces advisory remains unpatched upstream. The previously audited unknown historical payroll rate remains outside local P0 and must not be fabricated.
