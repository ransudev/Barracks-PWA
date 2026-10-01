# Phase 3: booking and queue branch ownership

Branch: `feat/multi-branch-foundation`. This phase is committed separately from Phase 1 and Phase 2. No push or merge is performed.

## 1. Files changed

Paths below are relative to the repository root.

- `README.md`
- `PHASE3_REPORT.md`
- `barracks-pwa/server/db/migrations/024_booking_queue_branches.sql`
- `barracks-pwa/server/auth/visit-branch-access.ts`
- `barracks-pwa/server/services/booking.service.ts`
- `barracks-pwa/server/services/booking-availability.service.ts`
- `barracks-pwa/server/services/queue.service.ts`
- `barracks-pwa/app/api/barbers/route.ts`
- `barracks-pwa/app/api/bookings/route.ts`
- `barracks-pwa/app/api/bookings/[id]/route.ts`
- `barracks-pwa/app/api/bookings/availability/route.ts`
- `barracks-pwa/app/api/queue/route.ts`
- `barracks-pwa/app/api/queue/[id]/route.ts`
- `barracks-pwa/app/api/queue/next/route.ts`
- `barracks-pwa/app/components/bookings/BookingForm.tsx`
- `barracks-pwa/app/pages/staff/BookingsPage.tsx`
- `barracks-pwa/app/pages/staff/QueuePage.tsx`
- `barracks-pwa/app/pages/staff/BarberFloorPage.tsx`
- `barracks-pwa/tests/branch-barber-api.test.ts`
- `barracks-pwa/tests/booking-migration.test.ts`
- `barracks-pwa/tests/queue-next-customer-ui.test.tsx`
- `barracks-pwa/tests/barber-floor-ui.test.tsx`
- `barracks-pwa/tests/payment-foundation.test.ts` (migration-count expectation only)

## 2. Migration

Migration 024 adds required `branch_id` to bookings and queue entries, with branch foreign keys using `ON DELETE RESTRICT`, and indexes for branch/date booking reads and branch/status/FIFO queue reads. Existing rows are backfilled to Main Branch, preserving status, snapshots, timestamps and historical references. Main Branch defaults retain compatibility with existing SQL import/seed paths.

Database triggers prevent branch ownership changes, reject new or changed barber assignments across branches, and enforce appointment queue/booking branch agreement. Barber row locks serialize assignment against Phase 2 branch moves. Historical references are allowed to remain after permitted barber moves.

Migration was exercised on disposable PostgreSQL schemas only. It was not applied to the shop database. Run the existing migration runner before using Phase 3 there.

## 3. Booking changes

Creation stores the authorized branch. Barber selection and availability consider that branch only. Editing retains the booking's persisted branch and rejects a barber from another branch. Existing customer-overlap/barber-overlap constraints, retry selection, lifecycle transitions, booking/queue locks, no-show rules, cancellation rules and historical deletion restrictions remain in place.

Check-in copies the booking's branch into the appointment queue entry. Customer creation and availability stay on Main Branch; no customer branch selector is added. Customer barber choices are filtered to Main Branch.

## 4. Queue changes

Walk-ins store the authorized branch; their idempotency fingerprint includes branch ownership. Active and completed-today collection reads accept a branch filter. Next-customer selection remains appointment/ready-priority and FIFO, scanning only the selected branch. Suggestion and confirmation validate the selected barber's branch; database guards also reject cross-branch assignments through direct writes. Queue ID changes authorize the entry's persisted branch, including appointment lifecycle changes delegated to bookings.

## 5. Authorization and UI

Shared visit authorization reuses Phase 1 membership and Phase 2 branch resolution. Managers and Front Desk access assigned branches; Administrators can select any branch. Existing role/action permissions remain unchanged: Front Desk performs operations, management views remain read-only except existing Administrator booking deletion.

Bookings and Queue use the existing branch-context hook. Selecting another branch remounts the workspace, clears open forms/drawers/suggestions and reloads scoped collections and barber choices. Old load responses are ignored by effect cleanup; old mutation responses update only the unmounted workspace. Barber Floor queue reads now follow its selected branch. Availability uses Phase 2 branch hours, barber shifts, breaks and absences.

## 6. Tests and final verification

Focused checks cover 29 distinct tests across existing suites, all passing after correcting a missing Queue component prop declaration and adapting the Barber Floor mock to branch query URLs:

- `branch-barber-api.test.ts`: extended with one integrated Phase 3 test for correct booking/walk-in ownership, assigned-staff collection and ID denial, cross-branch booking/queue barber rejection, appointment inheritance, Administrator access, selected-branch availability and next-customer isolation.
- `booking-migration.test.ts`: migration-count updates, booking ownership backfill assertions, and one queue history preservation test.
- `queue-next-customer-ui.test.tsx`: adapted scoped URLs and added one branch-switching test proving reload and suggestion cleanup.
- `barber-floor-ui.test.tsx`: adapted existing branch-switching coverage to scoped queue reads.
- Existing booking authorization/concurrency, queue lifecycle/next-customer and Phase 2 barber/hour integration tests were also run as focused regression checks.

Final results:

| Check | Result |
| --- | --- |
| Focused tests | 29 distinct tests pass; no skipped database checks |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `git diff --check` | Pass |
| Full `npm test` | Run once: 121 tests, 120 pass, 1 known attendance failure, 0 skipped |

The unchanged attendance test at `barracks-pwa/tests/attendance.test.ts:66` expects PostgreSQL `23503` while the existing RESTRICT foreign key returns `23001`. Attendance code, migration and assertion are unchanged in this phase. No browser/manual shop-database verification was performed; UI evidence is from DOM tests.

## 7. Remaining Phase 4 scope

Payment/transaction branch ownership, attendance branch ownership, inventory/restock branches and branch reports/dashboard aggregates remain deferred. Customer branch selection also remains deferred. This phase introduces no schema or implementation changes for those domains.

The pre-existing untracked `.DS_Store` is preserved and excluded from the Phase 3 commit.
