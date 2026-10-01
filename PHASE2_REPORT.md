# Phase 2 multi-branch delivery

Branch: `feat/multi-branch-foundation`. Continued from Phase 1 at `9c9fea5`.

## 1. Files changed

Paths are relative to the repository root. Older migrations and unrelated production modules were not edited. Legacy tests changed only for branch-required inputs, branch query/projection mocks, branch-switch behavior, or the migration count advancing to 23.

- `PHASE2_REPORT.md`
- `README.md`
- `barracks-pwa/app/api/barbers/[id]/route.ts`
- `barracks-pwa/app/api/barbers/[id]/schedule/route.ts`
- `barracks-pwa/app/api/barbers/[id]/status/route.ts`
- `barracks-pwa/app/api/barbers/route.ts`
- `barracks-pwa/app/api/shop-hours/route.ts`
- `barracks-pwa/app/lib/api.ts`
- `barracks-pwa/app/pages/admin/BarbersManagement.tsx`
- `barracks-pwa/app/pages/admin/ScheduleManagement.tsx`
- `barracks-pwa/app/pages/staff/BarberFloorPage.tsx`
- `barracks-pwa/app/utils/branch-context.ts`
- `barracks-pwa/app/utils/use-branch-context.ts`
- `barracks-pwa/server/auth/barber-branch-access.ts`
- `barracks-pwa/server/auth/branch-access.ts`
- `barracks-pwa/server/db/migrations/023_branch_barbers_and_hours.sql`
- `barracks-pwa/server/db/transaction.ts`
- `barracks-pwa/server/schemas/sprint.schema.ts`
- `barracks-pwa/server/services/barber-operational-availability.service.ts`
- `barracks-pwa/server/services/barber.service.ts`
- `barracks-pwa/server/services/booking-availability.service.ts`
- `barracks-pwa/server/services/branch-api.ts`
- `barracks-pwa/server/services/schedule.service.ts`
- `barracks-pwa/tests/barber-floor-ui.test.tsx`
- `barracks-pwa/tests/barber-schedule.test.ts`
- `barracks-pwa/tests/booking-authorization.test.ts`
- `barracks-pwa/tests/booking-availability.test.ts`
- `barracks-pwa/tests/booking-migration.test.ts`
- `barracks-pwa/tests/branch-barber-api.test.ts`
- `barracks-pwa/tests/branch-barbers.integration.test.ts`
- `barracks-pwa/tests/customer-deactivation.test.ts`
- `barracks-pwa/tests/database.integration.test.ts`
- `barracks-pwa/tests/payment-foundation.test.ts`
- `barracks-pwa/tests/permission-routes.test.ts`
- `barracks-pwa/tests/queue-availability.test.ts`
- `barracks-pwa/tests/validation.test.ts`

## 2. Migration

Added `barracks-pwa/server/db/migrations/023_branch_barbers_and_hours.sql`.

- `barbers.branch_id`: required FK to branches, Main Branch backfill, branch index, and Main Branch default for legacy SQL import/demo seed compatibility. Staff API inputs require an explicit branch.
- `shop_operating_hours.branch_id`: required FK, uniqueness on branch plus weekday; Main Branch hours retained.
- Other existing branches receive seven default days. A branch insert trigger seeds all seven days at 09:00–19:30.
- A database trigger prevents unsafe barber branch moves.
- Existing barber schedules, breaks and unavailability remain intact.

Only disposable test schemas were migrated. Migration 023 has not been applied to the real shop database.

## 3. Barber branch behavior

Administrator can manage barbers across all branches. Manager lists and ID operations are restricted to assigned branches. Front Desk Barber Floor selects an authorized branch and displays only its barbers and roster metrics. No barber login accounts were added.

Moves require access to both branches. Moves preserve shifts, breaks and absences; they are rejected when working shifts conflict with destination hours, or confirmed/checked-in/in-progress bookings or waiting/ready/in-progress queue entries remain. Historical records are retained.

## 4. Operating hours

Each branch owns a separate weekly schedule. The existing shop-hours API takes `branchId` as a query parameter; omitted staff selection resolves to primary/accessible branch context. Administrators can manage any branch. Managers retain schedule management within assigned branches. Front Desk cannot manage hours. Customers retain Main Branch hour reads; customer branch selection is deferred.

## 5. Schedules and availability

Creation initializes all seven barber days from the owning branch only, atomically. Working schedule edits must fit that branch's hours. Existing schedules are preserved when hours change, and availability intersects hours with shifts. Both shared availability services resolve barber → branch → operating hours. Any Available Barber calculations cache hours separately per branch.

## 6. Authorization and UI

Backend session role checks remain in place. IDs resolve actual barber ownership rather than trusting branch request parameters. A transaction and barber row lock cover authorization and ID operations, including absences and status changes. Managers cannot write commission/rating fields; global bulk commission and barber deletion remain Administrator-only.

The existing Barber Management, Schedule Management and Barber Floor pages reuse Phase 1 branch context and selection. Branch changes reload branch data, clear open editing state, and ignore obsolete load responses. Existing Barracks components and styles are preserved.

## 7. Tests and results

- Focused tests: **33 passed, 0 failed, 0 skipped**. Files: branch-barbers.integration, branch-barber-api, barber-schedule, barber-floor-ui, booking-availability, queue-availability, permission-routes, validation.
- Full `npm test`: **117 passed, 1 failed, 0 skipped** (118 total).
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no warnings or errors.
- `npm run build`: passed.
- `git diff --check`: passed.

Tests used the configured PostgreSQL connection with isolated disposable schemas. DOM tests verify selectors, roster replacement and corresponding operating hours. An authenticated real-browser walkthrough was not performed.

## 8. Local commits

- `ca63ebf` — feat: add barber ownership and branch operating hours
- `f095a24` — feat: enforce branch access for barbers and scheduling
- `fea0ca7` — ui: connect barber workspaces to assigned branch selection
- Final verification commit — test: verify phase 2 branch scoping and migration (includes this report, focused coverage, compatible legacy fixtures, and two small React lint fixes). Its hash is supplied in the chat handoff.

## 9. Pre-existing failure

`tests/attendance.test.ts:66` expects foreign-key error `23503`; PostgreSQL returns `23001` for the existing RESTRICT attendance FK. Reproduced from an untouched archive of Phase 1 at `9c9fea5`, and left unchanged.

The initial full run also encountered an intermittent booking exclusion-constraint concurrency deadlock (`40P01`); that test passed in the baseline run and final full run. No booking implementation or concurrency assertions were changed.

## 10. Scope and Git handoff

Nothing was pushed or merged. The task stops at Phase 2. Bookings, queue records, transactions/payments, attendance records, inventory, restocks, reports, customer booking flow and aggregate dashboards gain no branch ownership or branch filters. Shared availability now uses barber branch hours as required by Phase 2.

The pre-existing untracked root `.DS_Store` is preserved and excluded from commits.
