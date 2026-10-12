# User-story verification — October 13, 2026

This run tested all 31 documented stories across Administrator, Manager, Front Desk, Customer, Supplier and shared account behavior. Story outcomes below aggregate the 93 acceptance bullets in the [criterion-level matrix](criterion-matrix.md). A story is PASS only when every criterion is PASS. The aggregate remains conservative where automated coverage passed but full workflow evidence is missing.

## Source and environment

- Repository/worktree: `C:\Users\Lance\Documents\Barracks-booking-eligibility-20261013`.
- Branch: `codex/account-user-stories`.
- Starting source: `59a9c04a3ed0a523188310e36bc56242cab01170` (the user-story documentation commit). `origin/main` was fetched before testing and resolved to `6b65d8e4470303dbf590ceff3dc75f8f0b256b67`. Application code was unchanged from the starting source during this run; one account-workflow integration test was added in the working tree and included in the final suite.
- Database: disposable PostgreSQL database `barracks_sprint_demo_disposable` on `127.0.0.1:55434`; `DATABASE_SSL=false`; `POSTGRES_URL` empty. A read-only connection check confirmed database name, loopback server address and port. Test helpers create/drop isolated schemas and reject hosted/non-disposable targets. No hosted Supabase URL, hosted database, migration or data was used.
- Browser: local app at `http://localhost:3011` using synthetic local accounts only. Test data was created in the disposable database; no live customer, employee or payment records were used.
- Browser evidence was captured in the in-app browser during this run. The browser tool did not provide a supported way to export the images as workspace files, so there are no screenshot files to link. Screenshots remain available in the run's inline tool output; this limitation is recorded rather than claiming saved artifacts.
- Automated logs are outside Git: `C:\Users\Lance\AppData\Local\Temp\barracks-user-stories-20261013-tests-final.log` (full suite), `C:\Users\Lance\AppData\Local\Temp\barracks-user-stories-20261013-suite.log` (pre-addition baseline).

## Automated results

All commands ran from `barracks-pwa`. Commands using the database were run with `DATABASE_URL=postgresql://postgres@127.0.0.1:55434/barracks_sprint_demo_disposable`, `DATABASE_SSL=false`, and `POSTGRES_URL=''` set in the PowerShell process environment.

| Check | Exact command | Result |
| --- | --- | --- |
| New account workflow integration test | `node --import ./tests/helpers/css-register.mjs --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/account-workflows.integration.test.ts` | 1 passed, 0 failed, 0 skipped. Uses real handlers against the disposable database; mocks only the DB pool proxy and request cookie adapter. |
| Full automated suite | `npm test` | **167 passed, 0 failed, 0 cancelled, 0 skipped, 0 TODO** (66.3 seconds). Includes the new account workflow test. |
| TypeScript | `npx tsc --noEmit` | Passed. |
| Lint | `npm run lint` | Exit 0, 0 errors, 1 warning in unchanged `app/pages/staff/InventoryPage.tsx:429:50` (`admin` assigned but never used). |
| Default production build | `npm run build` | Passed; TypeScript and static generation completed (37/37). Built with the explicit local disposable database environment above. |

The test runner emitted its existing Node experimental module-mock and named-export deprecation warnings. No application code, permission, validation or assertion was weakened or changed.

## Story results by role

Open the criterion matrix for the status and evidence of every acceptance bullet. These aggregate statuses do not imply hosted or production acceptance.

| Role | Story | Result |
| --- | --- | --- |
| Shared | ACC-01 Sign in to the appropriate workspace | NOT TESTED |
| Shared | ACC-02 Sign out and prevent continued access | NOT TESTED |
| Shared | ACC-03 Work within the authorized branch or owner context | NOT TESTED |
| Administrator | ADM-01 Manage branches and staff assignments | NOT TESTED |
| Administrator | ADM-02 Administer staff accounts safely | NOT TESTED |
| Administrator | ADM-03 Maintain customer and supplier records | NOT TESTED |
| Administrator | ADM-04 Maintain the service catalog and barber settings | NOT TESTED |
| Administrator | ADM-05 Review business performance and audited financial records | NOT TESTED |
| Administrator | ADM-06 Prepare payroll without bypassing approval | NOT TESTED |
| Manager | MGR-01 Manage Front Desk staff within my authority | NOT TESTED |
| Manager | MGR-02 Maintain barber schedules and correct attendance | NOT TESTED |
| Manager | MGR-03 Maintain customers, suppliers and service offerings | NOT TESTED |
| Manager | MGR-04 Manage stock and receive deliveries | PASS |
| Manager | MGR-05 Review sales and make accountable financial corrections | NOT TESTED |
| Manager | MGR-06 Review and approve payroll | NOT TESTED |
| Front Desk | FD-01 Review today's workload | NOT TESTED |
| Front Desk | FD-02 Create a valid registered-customer appointment | NOT TESTED |
| Front Desk | FD-03 Check in and serve appointments | NOT TESTED |
| Front Desk | FD-04 Add and serve accountless walk-ins | PASS |
| Front Desk | FD-05 Review and confirm the next customer | NOT TESTED |
| Front Desk | FD-06 Take payment and reopen a receipt | NOT TESTED |
| Front Desk | FD-07 Maintain customers and today's barber attendance | NOT TESTED |
| Customer | CUS-01 Register for a customer account | NOT TESTED |
| Customer | CUS-02 Maintain my profile | PASS |
| Customer | CUS-03 Book at my chosen active branch | BLOCKED |
| Customer | CUS-04 Review, reschedule or cancel my appointments | NOT TESTED |
| Customer | CUS-05 Recover access when I cannot sign in | NOT IMPLEMENTED |
| Supplier | SUP-01 See my linked supplier business | NOT TESTED |
| Supplier | SUP-02 Review and fulfill my restock requests | PASS |
| Supplier | SUP-03 Review delivery history | NOT TESTED |
| Supplier | SUP-04 Change my password securely | PASS |

There were no story-level FAIL results: no acceptance bug was fully reproduced. Several criteria have NOT TESTED results because related tests or a partial UI path do not satisfy the full criterion. The only environment-blocked story was Customer booking: the local disposable branch/barber fixture exposed no selectable slot for the synthetic date, so no booking was submitted. This is a fixture limitation, not a reproduced product defect.

## Local browser and persisted-data evidence

- **Administrator:** Signed in to the local admin workspace; blocked the synthetic Front Desk account, reloaded and observed Blocked; login was denied with the account-blocked message; unblocked the account. Used the supplier directory to create a linked Supplier login; the UI showed connected portal access.
- **Manager:** Changed the synthetic registered customer's loyalty points from 0 to 5; Customer reload showed the saved balance. For restock, advanced the request to Delivered and received 4 of 5 units at ₱27 each. After reload, the request showed Received and Inventory showed quantity 6 and unit cost ₱27. A read-only database query confirmed starting quantity 2, ending quantity 6, one RECEIVE movement with the request reference, and delivered quantity 4. Automated integration coverage exercised invalid/duplicate receiving and concurrency; no real stock was touched.
- **Front Desk:** Added an accountless walk-in to Queue, reloaded and saw it Waiting. Edited the profile name; it remained marked as having no login account and retained 0 loyalty points. Read-only database reconciliation showed `user_id = null` and Queue #3 `waiting` in branch 1.
- **Customer:** Signed in, updated own profile name, saved and reloaded; the new name persisted while loyalty remained 5. Direct navigation to the admin workspace returned to the Customer workspace. The booking form had an active service and barber but no available slot for the test date/barber; the attempt stopped before submission.
- **Supplier:** Signed in to the linked portal and saw its company, linked item, request and line details. Advanced the request Pending → Accepted → Preparing → Shipped; reload retained Shipped. Direct navigation to the admin workspace returned to the Supplier workspace. Supplier delivery-history rendering after shop receipt and historical live-name snapshot behavior were not verified in the browser.

Synthetic identities were generated for this run and their passwords were not saved in Git or evidence. The post-journey read-only database check confirmed the synthetic accounts were verified, unblocked and undeleted, with password hashes (not plaintext) stored. Barbers and accountless walk-ins were treated as business records, not login roles.

The new database-backed API integration test also exercised valid/invalid login, blocked/unverified/deleted login denial, logout cookie invalidation and protected API denial; Customer signup, duplicate email and privileged-field rejection; self-profile ownership and loyalty protection; Supplier account linkage and duplicate rejection; and Supplier password validation, hash preservation, successful change and subsequent login. The matrix identifies the exact criteria supported by those assertions.

## Gaps and reproduced issues

- Customer recovery remains **NOT IMPLEMENTED** and open P1. A Forgot password control alone is not acceptance. The recovery policy, expiration, replay prevention and non-disclosure checks have not been implemented or verified.
- Customer successful booking remains BLOCKED by the local fixture's lack of a selectable slot. Add an eligible local schedule/fixture in a later test run, without changing production hours or attendance, and repeat a valid booking confirmation and persisted-ownership journey.
- Checkout, saved receipt reload, duplicate-payment prevention and refund audit/original-transaction preservation were not exercised as authenticated browser journeys in this run. Related automated coverage passed but does not complete those stories.
- Payroll browser approval, immutable snapshot reload and unresolved historical-rate handling were not exercised end-to-end. Related automated tests passed; no historical rates or records were altered.
- Supplier delivery history after receipt, snapshot preservation after live supplier/item rename, and cross-company browser ownership denial remain unverified.
- Hosted, deployment, production-readiness, restore, mobile/accessibility and recovery evidence are not part of this local run. No hosted state was queried or mutated.
- **Reproduced product bugs:** none. No expected/actual product mismatch was fully reproduced. Customer booking had no eligible slot in the local fixture and was stopped as BLOCKED rather than reported as a defect.

The [criterion-level matrix](criterion-matrix.md) is the linked 93-row result set. Existing automated coverage files are named alongside the gaps in the repository's test suite; a passing test count is not treated as full story acceptance.
