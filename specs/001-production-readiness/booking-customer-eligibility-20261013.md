# Appointment customer eligibility fix — October 13, 2026

Local fix and verification completed around 01:30–01:33 Asia/Manila. This is a local acceptance result; the broader release verdict remains **NOT READY**.

## Source and isolation

- Fetched `origin/main` before creating the branch and again after verification. Both reads resolved to `cfeecd70f46ee5b215abffae90d6d97ebe2d906b`.
- Branch: `codex/fix-booking-customer-eligibility`; worktree: `C:/Users/Lance/Documents/Barracks-booking-eligibility-20261013`.
- Implementation/test/README savepoint: `04c1d63f55588a4405e99413808bc6c32a79ca71`.
- Original checkout's modified AGENTS.md and unrelated untracked files were preserved. The verified sprint worktree was read only.
- Read applicable AGENTS.md, checklist.md and the hosted verification report in `C:/Users/Lance/Documents/Barracks-sprint-demo-20261013/specs/001-production-readiness/hosted-sprint-verification-20261013.md` before implementing.
- Test database: `postgresql://postgres@127.0.0.1:55434/barracks_sprint_demo_disposable`, `DATABASE_SSL=false`, empty `POSTGRES_URL`. A live query confirmed the database name and loopback address/port. Tests create and clean isolated schemas through the existing guarded helper.
- No hosted database environment file was loaded. No hosted data, hours, attendance, historical durations, payroll rates, migration, deployment, push or merge was changed.

## Diagnosis and behavior

`listCustomers` returns accountless profiles plus registered profiles whose users are undeleted and have the customer role. `createBooking` requires the latter through its users/roles inner join. The staff page previously passed every directory record to the shared picker and defaulted to the first record.

The staff page now retains only registered customers for choices, defaults and New booking availability. The shared form independently filters choices, clears a missing/accountless selection on refresh, disables submission immediately and rejects direct submission events with an invalid selection. The staff save handler independently verifies the selected ID against its eligible collection. No replacement customer is silently chosen when a selection becomes stale. Account deletion or role changes after the last read remain protected by the unchanged backend validation.

The other two consumers, `CustomerBookingPage` and `CustomerDashboard`, hide the customer picker and use session-scoped ownership. They remain exempt from the staff collection guard. `/api/customers`, customer editing and Queue were not restricted or changed. README explains the policy and directs accountless walk-ins to Queue.

## Local checks

| Check | Result |
| --- | --- |
| Focused Node suite | 7/7 pass, zero failures/skips: `booking-customer-eligibility.test.tsx`, `booking-customer-policy.test.ts`, `customer-booking-ui.test.tsx`, `queue-quick-walkin.test.ts`, `sprint-recent-changes.test.ts` |
| Full `npm test` | 166/166 pass; zero failures, cancellations, skips or TODOs |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass, zero errors; existing `InventoryPage.tsx:429` unused `admin` warning |
| Clean default `npm run build` | Pass with freshly installed dependencies and no pre-existing `.next`; Next 16.3.8 default Turbopack; no alternate bundler or build flags |
| `npm start -- --hostname 127.0.0.1 --port 3014` | Built candidate starts and serves the authenticated workflows |
| Diff review / `git diff --check` | Pass |

The new UI regression renders the real form with mixed customers and valid availability. It verifies registered selection/submission, removal and conversion of the selected profile, malformed/missing/accountless IDs, callback clearing without losing the time, direct submit-event rejection, recovery and hidden customer consumers. The new disposable-database regression verifies registered booking persistence, accountless rejection without an insert, role/deletion rejection, accountless profile editing, Queue assignment/start/completion, and unchanged user count. Existing focused tests additionally cover idempotent walk-in creation and contact-only editing.

The initial focused database attempt failed before assertions because the owner name from the older readiness cluster did not exist in the sprint cluster. The target was verified, its actual `postgres` owner used, and all focused/full checks passed. Existing Node module-mock experimental/deprecation warnings remain; no new test warnings were introduced. `npm ci` also reported existing install-script approval notices for esbuild/unrs-resolver; install and all requested checks succeeded.

## Local API and browser evidence

- Production build at **http://127.0.0.1:3014**, authenticated synthetic Front Desk account; no hosted browser actions.
- Staff New booking customer options were exactly the placeholder and registered `Sprint customer` (#1). Accountless `Sprint Edited` (#2) remained in the directory with `user_id IS NULL` and was absent from the picker.
- Clearing Customer disabled Create booking; selecting the registered customer restored submission for a valid slot.
- Browser created appointment **#2**, October 14, 2026, **09:00–09:45**, Barracks Basic, Sprint Barber, with `LOCAL booking eligibility verification 20261013` notes. The saved appointment drawer displayed Confirmed and the persisted facts. Read-only local SQL independently confirmed its status/date/time.
- The accountless directory drawer retained Edit profile, with name, phone and preferred-barber fields and no login fields. Its existing waiting Queue visit remained visible as a walk-in. Actual editing and service transitions executed in the disposable-schema regression above; the browser inspection did not mutate that pre-existing fixture visit/profile.
- Authenticated local production POST for accountless customer #2 returned **HTTP 400 / Customer not found**; local SQL confirmed zero bookings for that customer. An initial PowerShell probe returned 401 because its cookie jar did not forward the production Secure cookie over loopback HTTP; a Node HTTP probe explicitly forwarding only that local session cookie confirmed the authenticated 400. No credential/cookie values are recorded here.

Artifacts outside Git: `C:/Users/Lance/AppData/Local/Temp/barracks-booking-eligibility-20261013/` contains `full-tests.log`, `registered-picker.png`, and `registered-booking-saved.png`. Other successful check outputs are recorded in the chat tool results. Credentials were privately read from the existing disposable fixture artifact and never copied into Git or this evidence.

## Hosted and deployment gaps

The October 13 hosted report establishes the original mismatch; it does not verify this candidate. No new hosted API/browser or deployment evidence was collected. The live app remains unchanged by this work. Pushing, merging, deployment and any hosted action require separate authorization. After deployment, recheck the picker and registered booking flow on the exact deployed commit. Broader P1/operational/recovery release gates remain pending.
