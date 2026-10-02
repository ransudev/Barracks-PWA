# Phase 8: customer branch selection and booking flow

Branch: `feat/multi-branch-foundation`. Customer branch selection and booking only.

## 1. Files changed

- `README.md`, `PHASE8_REPORT.md`
- `barracks-pwa/app/api/customer-branches/route.ts`
- `barracks-pwa/app/api/services/route.ts`
- `barracks-pwa/app/api/shop-hours/route.ts`
- `barracks-pwa/app/lib/api.ts`
- `barracks-pwa/app/types/branch.ts`
- `barracks-pwa/app/pages/customer/CustomerBookingPage.tsx`
- `barracks-pwa/app/pages/customer/CustomerDashboard.tsx`
- `barracks-pwa/server/auth/visit-branch-access.ts`
- `barracks-pwa/server/services/branch.service.ts`
- `barracks-pwa/server/services/booking.service.ts`
- `barracks-pwa/tests/booking-authorization.test.ts`
- `barracks-pwa/tests/customer-booking-ui.test.tsx`

## 2. Customer branch-selection behavior

The existing customer booking page lists active branches from the customer-only `/api/customer-branches` endpoint, exposing branch identity and contact/location details without staff assignment data. The customer selection is remembered per user in browser session storage. Reopening booking validates the remembered ID against the active branch list; absent or stale selection defaults to Main Branch if active. If Main is unavailable, the customer must select another active branch. An empty active list prevents booking.

Customers retain no access to `/api/branch-context`, branch management or staff assignments. No customer branch column or account-wide preference was introduced.

## 3. Booking-flow changes

Barber, service, hours, availability and booking-create requests carry the selected `branchId` query parameter. Existing availability helpers already scope the roster, Any Available Barber allocation, branch hours, shifts, breaks, absences and conflicts; the customer form now supplies this scope. Closed days return no times, and slots must finish within the selected branch's hours and barber shift.

Services remain the existing shared active catalog. The schema has no branch service restriction model; Phase 8 does not invent one. Customer service reads still validate the selected branch.

New bookings persist the validated branch. Customer appointment reads show all owned bookings across branches. Editing loads choices and availability for the existing appointment's branch, independently of the remembered branch for new bookings. Edits retain persisted ownership; no transfer action exists.

## 4. Server validation

Customer branch resolution validates positive PostgreSQL integer IDs, existence and active status. Missing IDs safely resolve active Main Branch; invalid, missing or inactive selections return 400. Booking creation repeats branch validation at the service layer and joins/locks the active branch during insertion, so a concurrent deactivation cannot pass merely because an earlier API read succeeded.

The authenticated customer profile determines `customerId`, overriding client identity. Barber candidates must belong to the selected branch; the slot is recalculated immediately before writing. Existing migration 024 provides locked barber/visit integrity and immutable branch ownership; existing overlap constraints continue to handle booking races.

ID edits use the saved booking branch, ignoring a different selection in the query. Customer ownership and existing role/action restrictions remain enforced. History and customer cancellation remain available for owned bookings after their branch becomes inactive; inactive branches cannot be selected for new availability or booking.

## 5. UI behavior

Branch switches remount the booking workspace, clearing barber/date/time, service/notes drafts and availability state. Cleanup ignores obsolete branch roster/service/hour results and stale availability responses. The branch selector is disabled while booking submission is pending.

The reservation summary shows branch name/address and the chosen day's operating hours in Asia/Manila. Confirmation, upcoming appointments, appointment history and the edit dialog show the booking branch. Appointment editors use their saved branch and cannot select a transfer destination.

## 6. Focused tests

Added only two high-yield scenarios: one extended customer API/database test and one DOM branch-switch test. They cover all six requested outcomes plus safe Main defaulting, owner-authoritative creation, Any Available Barber allocation, closed days, retained inactive-branch history/cancellation and remembered selection.

Final focused command:

```sh
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/booking-authorization.test.ts tests/booking-availability.test.ts tests/booking-concurrency.test.ts tests/customer-booking-ui.test.tsx
```

Result: **13 passed, 0 failed, 0 skipped**. Development runs used only the affected customer booking tests. The DOM test isolates the unrelated top bar because Next's image component does not render directly in this Node/JSDOM environment; it exercises the actual booking page/form and branch switching. No browser/manual visual validation was performed.

## 7. Final verification

- Focused tests: 13 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, including the customer branch endpoint.
- `git diff --check`: passed.
- Full `npm test`, run once: **133 passed, 1 failed, 0 skipped**. The sole failure is unchanged `tests/attendance.test.ts:72`, expecting PostgreSQL `23503` but receiving `23001` on the attendance foreign-key deletion restriction. Attendance code/tests/migrations were not modified.

Database checks loaded the existing local environment and used disposable PostgreSQL schemas. No migration or seed was applied to the shop database. No new migration is required beyond the existing branch migrations.

## 8. Remaining multi-branch gaps

- Branch service restrictions do not exist in the current shared catalog; adding that model is separate work.
- Remembered customer selection is per browser session, not synchronized across devices/accounts.
- Existing branch migrations must be present in the target database; this phase did not verify or change the real shop database migration state.
- Booking transfers, inventory transfers, notifications, new payment features and additional reports remain outside this phase.

Phase 8 is committed separately on the requested branch. No push or merge was requested. The pre-existing untracked root `.DS_Store` is preserved and excluded from the commit.
