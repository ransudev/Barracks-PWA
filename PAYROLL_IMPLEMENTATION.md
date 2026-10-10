# Payroll implementation evidence

Scope: local implementation of `payrollspec.md` on `feature/barber-payroll`, 2026-10-10. This is not a deployment or a record of real payroll disbursement.

## Requirements and evidence

| Spec requirement | Implementation and verification |
| --- | --- |
| Original price, discounts, decimal rates, exact rounding | Completion snapshots preserve source prices; PostgreSQL NUMERIC rounds half up per service into integer centavos. Tests prove PHP 250 original / PHP 200 paid / 40% gives PHP 100, and individual 45%, 50%, 42.5% rates. UI formatting uses BigInt. |
| Refund retention and history stability | Immutable entries survive refunds, catalog changes, rate changes and barber branch transfers. Integration tests inspect retained values and reject snapshot edits. |
| Completion plus successful payment only | Deferred transaction triggers accrue only after a completed source and completed tender coexist; earned time is the later event. Tests reject unfinished, cancelled, no-show and unpaid accrual. Booking-linked queues use one booking identity. |
| Future-only rate changes | Effective-dated immutable history is selected at completion, serialized with rate writes through the barber row. Historical missing rates remain unresolved until a Manager appends evidence. Tests pay an earlier completion after a rate change and retain its original percentage. |
| Explicit 14-day Manila calendar | Branch anchor is required, period alignment/length enforced in PostgreSQL, generation requires a closed period. Tests place an exact Manila midnight boundary only in the next period. |
| Idempotency and late earnings | Unique service/tender and payroll assignment constraints, serialized generation and locked records. Tests cover concurrent generation/payment, checkout retries and supplements without rewriting approved records. |
| Draft, pending, approved, paid | Server commands and database triggers enforce transitions; return requires a reason; Manager identity/time lock the approved breakdown. Administrator approval and unapproved payment are rejected. |
| Corrections and audit trail | Signed itemized adjustments require actor/reason; locked-record corrections create separate drafts linked to approved payroll. Source references require the same barber/branch. Tests inspect audit events and preserve the original paid amount. |
| Branch and role security | Existing session and branch utilities protect every read/write; actor/membership are revalidated for mutations. API tests deny anonymous, Front Desk, customer and supplier before DB access. DB workflow tests reject Manager cross-branch read/approval/payment. RLS and browser-role grants are checked. |
| Overview, details, settings, history | Management route with constrained branch selector, current earnings and unassigned totals, closed-period drafts, service/source/rate/refund detail, rate history, correction approval history, searchable historical barbers, status/period filters and pagination. |
| Payslip | Paid-only print/Save PDF and downloaded standalone HTML include shop/barber, period, eligible services, gross, itemized adjustments, payable/paid, payment reference/method and Manager approval/time. Browser verification inspected the synthetic downloaded HTML and found no scripts. |
| Tips and wages excluded | No tips, base salary, attendance deduction, statutory calculation or automated transfer fields/workflows were introduced. Payroll service totals derive only from immutable commission entries and justified adjustments. |
| Existing integration/data preservation | Migration 028 is additive. Receipt/source deletion regression checks verify retained logical identity after live booking FK clearing. Barber profiles retain profile/rating controls; commission editing moves to audited settings. |

## Verification

- `npx tsc --noEmit`: passed.
- Scoped ESLint on payroll UI/API/schema/service/helpers/tests and Barber Management: passed.
- `npm run build`: passed with `/api/payroll` registered.
- Focused payroll/API tests after current-period overview additions: 4 passed, 0 skipped.
- Combined payroll, payment foundation, queue lifecycle and migration regression command:

```powershell
node --env-file=.env.local --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/payroll.test.ts tests/payroll-permissions.test.ts tests/payment-foundation.test.ts tests/queue-lifecycle.test.ts tests/booking-migration.test.ts
```

The combined suite uses disposable schemas and checks migration repeatability and financial/source deletion compatibility alongside payroll invariants. Final result: **21 passed, 0 failed, 0 skipped** (284 seconds). The browser fixture schema was also confirmed absent after shutdown, and its temporary script/environment files were removed.

Rendered browser verification used only a disposable schema and synthetic accounts: Manager submitted, approved and recorded a full external Cash payout; the original-price commission remained PHP 100; paid history survived a later rate change; settings displayed rate/correction actors; a paid payslip downloaded successfully. Responsive checks at 320, 768, 1024 and 1440 px found no document overflow after the table-container fix. Front Desk had no Payroll navigation and direct `/admin/payroll` navigation redirected to its staff dashboard.

## Activation decisions and deployment boundary

- No production migration, real payout, push or merge was performed. Read-only preflight found deployed migration 027 and no completed source rows missing a barber.
- Owner must choose the first period start date for each branch. Production dates are never inferred from the synthetic fixtures.
- Eligibility uses existing completed booking/walk-in records and the authoritative successful transaction tender. Historical missing percentages require Manager evidence rather than a fabricated backfill.
- Post-payment voids of qualifying services are blocked pending an owner policy; confirmed refund retention remains supported.
- MVP records one full external disbursement, with Cash, bank transfer or e-wallet labels. Partial payouts and automated transfers remain outside scope.
- Review historical unresolved rates and pre-calendar entries, apply migration 028 in the intended environment, then configure calendars/rates before relying on production payroll. The spec's separate employment/compliance review remains a production prerequisite.
