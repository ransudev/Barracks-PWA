# User-story test coverage — October 13, 2026

[Stories and acceptance criteria](README.md) describe 31 stories across five account roles plus shared behavior. This report separates existing automated assertions from complete story acceptance. **No story is declared fully accepted across every browser and hosted criterion by this report.**

## Current execution

- Source tested: `6b65d8e4470303dbf590ceff3dc75f8f0b256b67`, current `origin/main` when this work began. Documentation-only branch: `codex/account-user-stories`, reusing the isolated booking-fix worktree.
- Command: `npm test`, from `barracks-pwa`. Existing Node configuration includes the CSS loader, tsx, module mocks and serial test-file concurrency.
- Explicit environment: `DATABASE_URL=postgresql://postgres@127.0.0.1:55434/barracks_sprint_demo_disposable`, `DATABASE_SSL=false`, empty `POSTGRES_URL`. The existing helper rejects hosted/non-disposable targets and creates/drops isolated test schemas.
- Result: **166 tests, 166 passed, zero failures, cancellations, skips or TODOs**, about 65 seconds. Log: `C:/Users/Lance/AppData/Local/Temp/barracks-user-stories-20261013/tests.log` outside Git.
- Existing Node module-mock experimental/deprecation warnings remain. No test assertions were changed, no new application behavior was introduced, and no production fixture or hosted database was used.
- Diff whitespace and local Markdown link targets were checked. TypeScript, lint and build were not repeated for this documentation-only change; the source candidate already passed those checks in the [booking eligibility evidence](../001-production-readiness/booking-customer-eligibility-20261013.md).

## Traceability

All named test files below are under [`barracks-pwa/tests`](../../barracks-pwa/tests). “Support” means those tests ran successfully and assert relevant behavior, not that every acceptance criterion in a story is covered. The remaining checks column prevents a green suite from hiding untested story steps.

| Story | Executed automated support | Remaining checks for full story acceptance |
| --- | --- | --- |
| ACC-01 | `permission-routes.test.ts`, `view-access.test.ts`, `payroll-permissions.test.ts`: anonymous/role denials and direct page access | Actual credential/session creation, blocked/unverified/deleted login denials and authenticated reload for all five roles |
| ACC-02 | Permission suite proves anonymous requests are rejected, but does not exercise logout | Session invalidation after logout, old-cookie replay and browser back/reload behavior |
| ACC-03 | `branch-permissions.test.ts`, `branch-barber-api.test.ts`, `staff-branch-scope.test.ts`, branch/UI tests and owner-scoped booking/supplier tests | Authenticated end-to-end switching for each applicable module and role |
| ADM-01 | `branches.integration.test.ts`, `branch-permissions.test.ts`, `branches-ui.test.tsx`: branch CRUD, primary membership and Administrator gates | Real Administrator browser create/edit/assignment and feedback |
| ADM-02 | `staff-authorization-matrix.test.ts`, `staff-branch-scope.test.ts`, `staff-management-ui.test.tsx`, `database.integration.test.ts` | Real staff lifecycle form/session transitions and target rejection displays |
| ADM-03 | `customer-deactivation.test.ts`, `sprint-recent-changes.test.ts`, `supplier-permission.test.ts`, `sprint2.integration.test.ts`, API role matrix | Supplier login-creation endpoint success/duplicate cases and complete directory workflows in a browser |
| ADM-04 | `sprint-recent-changes.test.ts`, `barber-schedule.test.ts`, `barber-floor-ui.test.tsx`, `barber-manager-form.test.tsx`, role and payroll tests | Complete Administrator catalog/profile/schedule/rate forms and confirmations |
| ADM-05 | `revenue-report.test.ts`, `reports-ui.test.tsx`, `payment-actions.test.ts`, `payment-ui.test.tsx`, `permission-routes.test.ts` | Real report/receipt/correction journeys; global Inventory report presentation; physical receipt printing |
| ADM-06 | `payroll.test.ts`, `payroll-permissions.test.ts`: rates, periods, accrual, state/role rules, immutable snapshots and payment | Real payroll preparation and payment UI, invalid approval feedback and unresolved-rate presentation |
| MGR-01 | `staff-branch-scope.test.ts`, `staff-management-ui.test.tsx`, `staff-authorization-matrix.test.ts` | Real Manager full/partial/shared membership flows and current-access changes |
| MGR-02 | `attendance.test.ts`, `attendance-ui.test.tsx`, `barber-manager-form.test.tsx`, `branch-barber-api.test.ts`, `permission-routes.test.ts` | Browser schedule and history-correction forms, reason/error presentation |
| MGR-03 | `supplier-permission.test.ts`, `supplier-permission-ui.test.tsx`, `sprint-recent-changes.test.ts`, `validation.test.ts`, API role tests | Browser customer loyalty updates, supplier editing and service archival/restoration |
| MGR-04 | `sprint2.integration.test.ts`, `inventory-concurrency.integration.test.ts`, `inventory-branch-ui.test.tsx`, `app-shell-inventory-alerts.test.tsx` | Browser request → fulfillment → delivery → receiving with line quantities; reload reconciliation |
| MGR-05 | `payment-actions.test.ts`, `revenue-report.test.ts`, `reports-ui.test.tsx`, `payment-ui.test.tsx`, role matrix | Authenticated Manager report/refund UI and receipt audit presentation |
| MGR-06 | `payroll.test.ts`, `payroll-permissions.test.ts`: Manager-only approval/correction, missing rates, immutable finalization | Real review/return/approve/correct/adjust UI and reason/branch feedback |
| FD-01 | `staff-dashboard-queue.test.tsx`, `service-interval.test.ts`, `queue-availability.test.ts` | Real dashboard refresh under empty, slow and failed APIs |
| FD-02 | `booking-customer-eligibility.test.tsx`, `booking-customer-policy.test.ts`, `booking-availability.test.ts`, `booking-concurrency.test.ts` | Current authenticated browser stale-list refresh scenarios; hosted picker and valid booking on a deployed candidate |
| FD-03 | `queue-lifecycle.test.ts`, `queue-availability.test.ts`, `booking-authorization.test.ts`, `service-start-races.test.ts` | Browser check-in/start/complete/cancel/no-show with real supported time and state |
| FD-04 | `queue-quick-walkin.test.ts`, `booking-customer-policy.test.ts`, `sprint-recent-changes.test.ts` | Complete browser quick-walk-in/edit/serve flow and visible retry/error handling |
| FD-05 | `queue-next-customer.test.ts`, `queue-next-customer-ui.test.tsx`, `queue-smart-selection.test.ts` | Real stale-suggestion review/confirm/start journey, including branch changes |
| FD-06 | `payment-foundation.test.ts`, `payment-ui.test.tsx`, `branch-barber-api.test.ts`, `permission-routes.test.ts` | Real browser service completion → checkout → saved receipt; physical printing |
| FD-07 | `sprint-recent-changes.test.ts`, `attendance.test.ts`, `attendance-ui.test.tsx`, `barber-floor-ui.test.tsx`, API/schema checks | Browser accountless save/reload and attendance action feedback; real-clock service/clock-out interaction |
| CUS-01 | `validation.test.ts`, `database.integration.test.ts`: account/schema lifecycle support | Direct signup success/duplicate/privileged-field and resulting session tests; registration browser journey |
| CUS-02 | `validation.test.ts`, `database.integration.test.ts`, view-access/role checks: profile validation and update support | Dedicated `/api/customers/me` owner-isolation and browser save/reload tests |
| CUS-03 | `customer-booking-ui.test.tsx`, `booking-authorization.test.ts`, `booking-availability.test.ts`, `booking-concurrency.test.ts` | Real Customer booking, confirmation and session-owner spoofing journeys |
| CUS-04 | `booking-authorization.test.ts`, `customer-deactivation.test.ts`: ownership, state, original branch and inactive-branch handling | Real history, reschedule and cancellation UI with another customer's IDs and inactive branch |
| CUS-05 | No recovery acceptance test; open P1 story in readiness scope | Implement/approve recovery policy and complete secure recovery tests; do not treat current button as acceptance |
| SUP-01 | `sprint2.integration.test.ts`, `permission-routes.test.ts`, `view-access.test.ts`: linked scope, inactive suppliers and role boundaries | Real Supplier login/portal populated data, unlinked/inactive feedback and cross-company browser checks |
| SUP-02 | `sprint2.integration.test.ts`: supplier ownership and Accepted/Preparing/Shipped transitions, denial of supplier Delivered | Browser fulfillment transitions and saved-status reloads |
| SUP-03 | `sprint2.integration.test.ts`: persisted request/movement history and snapshots | Portal delivery-history rendering and reload for the linked supplier |
| SUP-04 | Source inspected: `app/api/supplier/account/route.ts`; no dedicated success/negative runtime assertions found | Current-password verification, invalid/same new password, hash preservation, successful change and subsequent login |

Permission-route tests mock sessions and selected database interactions. They prove 401/403 gates and representative assertions; an allowed route reaching validation is not proof that its full write succeeded. Disposable-database tests prove persisted service behavior and concurrency, but do not include real browser sessions. JSDOM tests prove their component interactions, not hosted rendering.

## Browser and hosted evidence

No new browser or hosted test was run for this documentation task. Earlier evidence is useful context, not fresh acceptance for all these stories:

- [Local booking eligibility verification](../001-production-readiness/booking-customer-eligibility-20261013.md) records Front Desk picker/registered-booking acceptance, local HTTP rejection of accountless appointments, and directory/Queue inspection on the same source candidate.
- [Local sprint verification](../001-production-readiness/sprint-demo-20261013.md) records selected earlier Customer/Front Desk/Manager workflows and its exact source/environment.
- The hosted report remains in the separate verified worktree at `C:/Users/Lance/Documents/Barracks-sprint-demo-20261013/specs/001-production-readiness/hosted-sprint-verification-20261013.md`. Its selected role/module reads do not prove complete hosted lifecycle/checkout/payroll acceptance or the newly pushed eligibility fix.
- No deployment identity, hosted API/browser status or production data was changed or newly verified here. [Readiness gates](../001-production-readiness/checklist.md) remain separate and pending.

## Follow-up acceptance order

1. Add direct account/session/signup/profile/password regressions for the explicit coverage gaps above using disposable identities and no retained plaintext credentials.
2. Run authenticated local browser journeys for Administrator, Manager, Front Desk, Customer and Supplier with both allowed and denied actions. Record each story's exact criteria, persisted result and screenshot rather than checking off an entire role from its dashboard.
3. For financial/stock/payroll flows, reconcile saved snapshots, transaction/tender/stock movements and final state after reload; do not infer completion from a toast.
4. With separate authorization, verify the deployed commit and execute permitted hosted acceptance during supported hours. Keep missing historic durations/rates unresolved and retain broader restore/accessibility/recovery gates.

This task creates the stories and runs/maps the current automated suite. It does not silently implement open stories, change role policy or label the complete product release-ready.
