# Phase 5 — Attendance branch ownership

Branch: `feat/multi-branch-foundation`. Phase 5 is a separate commit; no push or merge is performed.

## 1. Files changed

- `README.md`, `PHASE5_REPORT.md`: behavior, historical limitation, verification and deferred scope.
- `barracks-pwa/server/db/migrations/026_attendance_branches.sql`: attendance ownership and history safeguards.
- `barracks-pwa/server/services/attendance.service.ts`: scoped reads and transactional write authorization.
- `barracks-pwa/app/api/attendance/today/route.ts`
- `barracks-pwa/app/api/attendance/today/[barberId]/route.ts`
- `barracks-pwa/app/api/attendance/history/route.ts`
- `barracks-pwa/app/api/attendance/[id]/corrections/route.ts`
- `barracks-pwa/app/lib/api.ts`: attendance `branchId` response type.
- `barracks-pwa/app/pages/admin/AttendanceManagement.tsx`
- `barracks-pwa/app/pages/staff/BarberFloorPage.tsx`
- `barracks-pwa/tests/attendance.test.ts`
- `barracks-pwa/tests/attendance-ui.test.tsx`
- `barracks-pwa/tests/barber-floor-ui.test.tsx`
- `barracks-pwa/tests/booking-migration.test.ts`
- `barracks-pwa/tests/payment-foundation.test.ts`

The booking/payment migration tests only update expected total migrations from 25 to 26.

## 2. Migration

Migration 026 adds required `barber_attendance.branch_id`, a branch FK with `ON DELETE RESTRICT`, and `(branch_id, attendance_date DESC, barber_id)` index. The agreed backfill assigns all legacy records to Main Branch. Legacy attendance has no stored original branch or barber-move history, so exact historical ownership cannot always be reconstructed. No existing attendance values, timestamps or correction rows are rewritten; a disposable-schema regression compares them before and after migration, including a barber moved before backfill.

An insert trigger derives the barber's current branch and rejects explicit mismatched ownership. An update trigger prevents changing the record's branch or barber. There is no composite FK to the barber's current branch, so moving a barber does not invalidate or relocate historical attendance. Existing deletion RESTRICT behavior remains unchanged. Migration 026 was exercised in disposable schemas; it was not applied to the shop database. Apply it through the existing `npm run db:migrate` workflow before using Phase 5.

## 3. Attendance ownership behavior

New attendance snapshots the barber's branch on the server after locking the barber. The body schema rejects client `branchId`. Existing daily records and management corrections authorize their stored historical branch and retain it. Staff role and branch authorization are checked inside the write transaction. Existing clock rules, one attendance record per barber per Manila day, immutable correction history and barber-no-login design remain intact. A same-day barber move cannot create a second record in the destination branch or grant destination-only staff access to the original record.

## 4. Authorization and UI

Today's records, management history and correction audit reads filter stored branch ownership. Administrator reads can span every branch; Manager/Front Desk reads are limited to memberships. Explicit `branchId` narrows reads and rejects unauthorized branch selection with 403. Daily writes and corrections reject unauthorized ownership with 403. Foreign correction audit lookups return an empty list. Existing role gates remain: Front Desk uses daily attendance; history/corrections require management.

Attendance Management uses existing branch context, reloads history and roster, resets filters/dialogs on switching, and ignores stale filter loads. Historical filter options include barbers found in records after they move. Barber Floor loads and submits attendance against its selected branch, retaining its existing branch reload protection and workflow.

## 5. Focused tests

Extended existing suites rather than duplicating coverage. Two new database tests cover inheritance, rejection of unauthorized creation, history after a move, assigned Manager/Front Desk read/write denial, Administrator global access, immutable ownership and legacy Main Branch backfill preservation. The existing Manager UI test switches branches and proves new data replaces old records/audit dialog. Existing floor and permission tests use scoped attendance URLs.

Final focused command (with the existing `.env.local` loaded, no credentials printed):

```sh
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/attendance.test.ts tests/attendance-ui.test.tsx tests/barber-floor-ui.test.tsx tests/branch-barbers.integration.test.ts tests/permission-routes.test.ts
```

Result: **18 passed, 1 known baseline failure, 0 skipped (19 tests)**. All new Phase 5 tests and branch-switch coverage passed. The only failure is the unchanged attendance barber-delete assertion, formerly line 66, now line 72: expected `23503`, actual PostgreSQL `23001` from the existing RESTRICT FK. Neither assertion nor unrelated FK behavior was changed.

## 6. Final verification

- Focused tests: 18 passed / 1 unchanged baseline failure / 0 skipped.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed without warnings.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full `npm test`: run **once**; **125 passed / 1 unchanged attendance baseline failure / 0 skipped (126 tests)**.

The repaired Phase 4 regression **“pre-action reversed transactions are counted once using their transaction date”** passed in the full run. Phase 4 Main Branch backfill preservation and payment branch integrity tests also passed.

Verification initially caught a test-only literal type annotation and a React cleanup lint warning. Both were corrected; TypeScript, lint and build then passed, and attendance UI tests were rechecked (2 passed). The full suite was not repeated. Database evidence comes from disposable PostgreSQL schemas; UI evidence comes from DOM tests. No manual browser or production verification was performed.

## 7. Remaining Phase 6 scope

Inventory/restock branch ownership, branch reports/dashboard aggregates and customer branch selection remain deferred. No new payment features or changes to financial ownership were introduced. Existing unrelated `.DS_Store` is preserved and excluded from the commit.
