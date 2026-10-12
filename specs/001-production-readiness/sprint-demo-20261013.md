# October 13 sprint demo verification

Verified October 13, 2026, 00:04–00:15 Asia/Manila. Verdict: **local sprint demo verified; hosted rollout pending; broader production readiness NOT READY**.

## Identity and boundaries

- Dedicated branch: `codex/sprint-demo-20261013`; worktree: `C:/Users/Lance/Documents/Barracks-sprint-demo-20261013`.
- Base: current `origin/main`, `a02299c7642588e23700d0820a857ab99ca131bb`. Fetched and rechecked at the beginning and end; unchanged.
- Application fix savepoint: `1074fb4`; verified source/test candidate: `6b37d1019068a40c110c8b31f126a802b853fc74`. The final documentation commit adds this report and links only.
- Original checkout remains on `codex/edit-walkin-customers` at `1b56a61`. Its pre-existing AGENTS.md edit, auditspec.md and untracked readiness logs remain untouched.
- Local database only: a new PostgreSQL 17 cluster at `127.0.0.1:55434`, database `barracks_sprint_demo_disposable`, TLS disabled. Each suite fixture uses its own disposable schema. Browser mutations use the local public schema. No hosted database URLs or environment files were loaded.
- Production build served at `http://127.0.0.1:3013`. Synthetic customer, Front Desk, Manager and Administrator accounts; only Customer, Front Desk and Manager were used in browser acceptance.
- No push, merge, deploy or hosted migration. Migration 031 was applied only to disposable local schemas/database.

## All 13 original failures

The original report and complete log were read before source changes: `C:/Users/Lance/AppData/Local/Temp/barracks-sprint-verification-20261012/{SPRINT_VERIFICATION.md,full-tests.log}`.

| Original failed test | Diagnosis | Resolution and evidence |
| --- | --- | --- |
| Customer cancellation is owner-scoped and limited to confirmed bookings | The lifecycle start used the real clock near 23:45; its 45-minute snapshot exceeded the fixture's 23:59 shift. Cancellation assertions were never reached. | Controlled 10:00 Manila fixture; owner/staff/status assertions retained and passed. |
| PostgreSQL rejects overlapping barber and customer bookings under concurrent writes | Reservation contention passed, but the later appointment start exceeded the late-night fixture shift. | Controlled clock; concurrent exclusion, lifecycle, completed-today and no-show grace checks passed. |
| Phase 3 visits persist branch ownership, isolate staff access and inherit appointment branches | `getNextCustomer` could not offer the 45-minute walk-in near closing; undefined was asserted as the main-branch visit ID. | Controlled clock; real branch/API isolation and suggestion assertions passed. |
| PostgreSQL account, inventory, and barber lifecycle persists safely | The edited 30-minute appointment could not finish within the late-night shift. | Controlled clock; account/inventory/customer/barber lifecycle assertions passed. |
| History sends search, method and month filters and paginates a selected day | `input[type="text"]` matched no element: the search input has an accessible label and implicit text type. | Select `input[aria-label="Reference or customer"]`, assert actual input, then exercise search submission, method/month query parameters, selected day and 20/5 item pagination. Passed. |
| Queue assignments, appointment lifecycle and simultaneous starts share one barber guard | Both start attempts failed off-shift; the test expected exactly one successful start. | Controlled clock; one start wins, the other reports active-service conflict, and appointment/completed-today checks pass. |
| Walk-in and appointment service paths preserve lifecycle and timestamps | A 45-minute start crossed the fixture's 23:59 end. | Controlled clock; lifecycle denials and ordered start/completion timestamps passed. |
| Next customer prefers assigned ready entries, then the oldest unassigned walk-in | No full-duration walk-in fit near closing, so the expected suggestion was absent. | Controlled clock; assignment/appointment priority, FIFO, state preservation and completed-today checks passed. |
| Next Customer skips conflicts, keeps appointment priority, and rechecks assignments | Only the short service still fit near closing, so it displaced the expected long FIFO entry before the test introduced a reservation. | Controlled clock; FIFO, deliberate reservation conflict, appointment priority, stale assignment, breaks and hours checks passed. |
| Manual and suggested starts use immutable visit duration after catalog changes | Shift rejection occurred before the intentionally inserted future absence, producing the wrong reason. | Controlled clock; immutable snapshot, future absence rejection and fitting short service start passed. |
| Today attendance blocks starts, preserves future booking slots, and rejects active clock-out | Attendance rules ran, but clock-in could not make a 45-minute late-night start fit the shift. | Controlled clock; absent/clocked-out rules, future slots and active-service clock-out rejection passed. |
| A reservation racing a manual start cannot leave overlapping committed work | Real defect: a 23:51 ten-minute reservation stores `end_time` around 00:01. Both the service query and migration 030 trigger treated that as an earlier same-day end. Both operations could commit. | Controlled 23:46 reproducer failed before the fix with 2 winners; now day and midnight lock-contention cases each permit one winner only. |
| A start delayed on a barber lock records the actual start and protects its remaining interval | Same real trigger defect: the subsequent wrapped reservation bypassed the active-service interval. | Controlled 23:46 reproducer failed before the fix with missing rejection; now day and midnight cases reject the reservation, while retaining post-lock start timestamps. |

## Focused fix and meaningful boundaries

Both application guards and migration `031_booking_midnight_overlap.sql` use dated start plus immutable saved duration, matching migration 011's existing exclusion ranges. `end_time` remains a display value. Unknown historical booking durations still conservatively occupy their day. No duration, attendance, shift, permission, collision or legacy payroll policy was weakened.

The application queries also include previous-day reservations that continue into the selected/current day. Regression evidence covers:

- Real transactions observed waiting on PostgreSQL barber locks before release, at 10:00 and 23:46 Manila; exactly one racing operation commits.
- Delayed starts record the authoritative post-lock instant and reject later overlapping reservation writes.
- A wrapped reservation committed first blocks manual and suggested starts and leaves the visit ready with no start timestamp.
- Migration 031 preserves an active queue row byte-for-byte (JSON row equality), reproduces the old trigger defect explicitly on migration 030, then rejects the same reservation after upgrade.
- Exact active-service end allows adjacency; moving the reservation one microsecond earlier is rejected. Unknown booking duration is not inferred from an end TIME.
- A 23:50 reservation with saved 40-minute duration blocks 00:05 starts and 00:15 booking slots on the next day; 00:30 is allowed. Changing its display end to 00:01 cannot bypass the collision. Cancellation frees the interval.
- A 23:46 start with saved 15-minute duration is still rejected against 23:59 hours.
- The two previously temporary walk-in editing/service preservation regressions are now part of the permanent full suite.

The test clock is opt-in and schema-local. It fixes the calendar/time origin and advances with elapsed real time, preserving lock-delay evidence. SQL `now()`, `clock_timestamp()`, CURRENT_TIMESTAMP and CURRENT_DATE share that fixture clock; production code has no clock override. The first controlled aggregate exposed three completed-today assertions because SQL keywords still used the real calendar; the adapter correction made those deterministic too. These were harness failures, not production calendar changes.

## Local checks

| Check | Result | Evidence |
| --- | --- | --- |
| Fresh independent `npm ci --no-audit --no-fund` | PASS, 418 packages installed; no node_modules links or copied build output | New worktree dependency install |
| Pre-fix midnight reproduction | Expected FAIL: 6 tests, 4 passed, 2 failed, zero skipped | `barracks-demo-midnight-before.log` |
| Focused midnight/migration/recent features | PASS: 12/12, zero failures/skips | `barracks-demo-boundaries.log` |
| Final `npm test` | PASS: **164 tests, 164 passed, 0 failed, 0 skipped, 0 cancelled** | `barracks-demo-full-final.log`, 66.495 seconds, on 6b37d10 |
| `npx tsc --noEmit` | PASS after clean build generated Next route types | `barracks-demo-typecheck-final.log` |
| `npm run lint` | PASS: 0 errors, 1 existing warning, InventoryPage.tsx:429 unused `admin` | `barracks-demo-lint-final.log` |
| Clean default `npm run build` | PASS, Next 16.3.8 default Turbopack; fresh .next; no alternate bundler or bypass flag | `barracks-demo-build.log` |
| Production start | PASS on loopback port 3013 | `npm start -- --hostname 127.0.0.1 --port 3013` |
| Diff review | PASS, `git diff --check`; focused staged files only | Local savepoint commits |

Final count: original 156 + 2 additional day/midnight race variants + 4 new midnight/preservation tests + 2 permanent supplemental tests = 164. No failing test was skipped or removed. Node module-mock experimental/deprecation warnings remain. npm install reported esbuild/unrs-resolver install-script approval notices; compilation and build succeeded. Dependency versions did not change; the prior production vulnerability audit is historical evidence, not rerun here.

Logs and screenshots are outside Git under `C:/Users/Lance/AppData/Local/Temp/barracks-sprint-demo-evidence-20261013/`. Credentials are generated in a separate private temporary file and are not included in this report or committed artifacts.

## Local authenticated browser and persisted data

Browser acceptance occurred around 00:08–00:15 Manila on the clean production build with real server/database clock. Only the disposable fixture has all-day hours; production hours were untouched.

1. Customer chose Main Branch, Barracks Basic, Sprint Barber and October 13 00:15–01:00. Confirmation showed booking #1, saved 45-minute service and ₱300. Screenshot: `booking-confirmed.png`.
2. Front Desk checked in booking #1; Queue showed appointment #1 as Ready with the saved scheduled time. Appointment actions are correctly managed through Bookings.
3. Front Desk started and completed the appointment through Bookings. Local SQL verified booking and linked queue both `completed`, non-null start, and completion >= start.
4. Completed unpaid visit appeared in checkout. Front Desk recorded synthetic cash ₱500 against ₱300, confirmed explicitly, and received ₱200 change. Exactly one transaction and tender persisted.
5. After reloading, history search `Sprint` plus Cash showed October 13's one ₱300 transaction. Day detail reopened the persisted receipt with reference, customer/service/barber/cashier, ₱300 total, ₱500 received, ₱200 change and completed status. Screenshot: `receipt.png`.
6. The Print Receipt action invoked printing but stalled the in-app browser's automation. Reload restored interaction. Receipt rendering/reopening and the print invocation regression passed; physical printing/PDF output is **not verified**. There is no evidence here of a production print regression.
7. Front Desk created accountless Sprint Walkin from Queue, then edited the last name to Edited and phone to `09123456781` from Customers. No email/password inputs or loyalty write controls were offered. SQL confirmed `user_id IS NULL`, loyalty 0 and four unchanged login accounts. Screenshot: `walkin-edited.png`. The profile form continues to require the existing local 11-digit phone format; a newly typed +63 value was rejected as expected by that schema.
8. Manager created a synthetic unused service, edited price ₱125→₱150, archived, restored and deleted it through explicit dialogs. Catalog returned to its original three active services. Manager also archived/restored the used Barracks Basic; Delete stayed unavailable and booking, queue, transaction and tender history remained. Screenshot: `used-service-archived.png`. Database regression separately rejects deletion of used services.

UI automation date filling required a keyboard increment/decrement to publish the date change; the resulting visible confirmation and persisted row established the correct date. That automation limitation did not require an application change.

## Hosted/deployment evidence and remaining gates

The user-supplied October 12 verification established deployment of a02299c and focused live walk-in/service checks. This task did not repeat hosted browser/runtime acceptance or inspect the Vercel deployment. Current origin/main remains a02299c; the local fix is not there.

For a hosted sprint demonstration, explicitly authorize reviewed merge/push/deployment and migration 031 on the named hosted target, then verify that exact release through the intended hosted workflow. Do not claim the live app contains these fixes until that happens. A local demonstration can use the verified loopback build and synthetic data.

The production-readiness checklist's required P1 work, D03–D06 decisions, complete hosted/staging operational acceptance and isolated backup restore remain pending. Local sprint acceptance is not a broader production-release verdict. No fabricated historical duration or commission rates, unrelated UI redesign, or production-data workaround was introduced.
