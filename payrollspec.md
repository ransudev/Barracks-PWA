# Barracks PWA — Barber Payroll Specification

**Version:** 1.0  
**Date:** 2026-10-10  
**Status:** Approved business rules; implementation not started  
**Scope:** Commission-based barber payroll integrated with existing Barracks bookings, queue, payments, barbers, branches, and role permissions.

## 1. Purpose

Automate barber earnings, group them into biweekly payroll periods, require Manager approval, record disbursement, and provide auditable payslips. Reuse operational data already captured by Barracks rather than re-entering completed services.

This document specifies desired behavior, not features confirmed to exist in the current application.

## 2. Confirmed business rules

| Topic | Rule |
| --- | --- |
| Compensation | Commission only; no base salary component in MVP |
| Frequency | Biweekly, meaning consecutive **14-day** periods, not twice per calendar month |
| Barber rates | Each barber has an individually configured percentage |
| Commission basis | The **original service price**, before any customer discount |
| Tips | Barbers receive tips directly; do not capture or calculate tips in payroll |
| Refunds | **The barber keeps earned commission if the transaction is later refunded** |
| Rate changes | **New rates apply only to future services**, never retrospectively |
| Approval | A **Manager** must approve payroll before it can be marked Paid |
| Branches | Payroll and commission entries remain associated with their originating branch |
| Source of earnings | Eligible completed **and paid** service transactions; a booking alone never creates payable commission |

All financial values use Philippine pesos (PHP). Payroll dates/times use the Asia/Manila timezone.

## 3. Definitions and eligibility

- **Original service price:** The service's undiscounted selling price captured at the time of service, not the current catalog price or amount paid after discounts.
- **Commission rate snapshot:** The percentage assigned to the barber for that service at its completion time. This value becomes immutable for the service, even if the barber's configured percentage changes later.
- **Qualifying service:** A service that is completed and for which checkout/payment has succeeded. The first moment both conditions are true is the commission's **earned_at** timestamp.
- **Payroll period assignment:** Place a commission in the period containing its earned_at timestamp. Use half-open period ranges: start inclusive, end exclusive.
- **Earned commission:** Once a commission has qualified, a later customer refund does not erase or reduce it. A later service catalog edit or commission-rate edit also does not affect it.
- **Non-qualifying service:** Cancelled, no-show, unfinished, or never-paid service. A payment attempt, reservation, or queue entry by itself must not generate commission.
- **Transaction voids:** A transaction voided before it ever qualifies produces no commission. Treatment of an already-earned commission after a *post-payment void* is **not yet confirmed**; do not silently treat that as a refund or reverse it. Require a defined policy before implementing such an edge case.

### Commission formula

For each eligible service line:

**Service commission = original service price × snapped barber commission rate**

**Biweekly gross commission = sum of eligible service commissions for that barber and branch in the period.**

A percentage such as 42.5% must be supported. Store money in integer centavos (or an exact NUMERIC type); never use floating-point arithmetic for money. Define one consistent round-to-centavo policy for each service line before summing.

**Example:** A haircut has an original price of PHP 250, a PHP 50 discount, and a barber rate of 40%. The customer pays PHP 200 but the barber earns **PHP 100**, not PHP 80. If the PHP 200 is subsequently refunded, the barber still earns PHP 100.

### Different commission rates

| Barber | Sample rate | Original sales | Gross commission |
| --- | ---: | ---: | ---: |
| Juan | 40% | PHP 12,000 | PHP 4,800 |
| Mark | 50% | PHP 15,000 | PHP 7,500 |
| James | 45% | PHP 10,000 | PHP 4,500 |

Illustrative values only, not Barracks payroll data.

## 4. Commission changes and historical integrity

- Managers or authorized Administrators can set a barber's commission rate subject to existing management permissions.
- Record a rate history: barber, old rate, new rate, effective timestamp, changed_by, and change reason.
- A change takes effect for **services completed at or after** its effective timestamp. Services completed earlier retain their original snapped rate, including those paid later.
- Prevent edits to a rate snapshot on an already-completed service. Correct genuine recording errors through an explicit audited correction process, never by cascading an edited master rate across historic commissions.
- If a barber moves branches, previously earned commissions remain owned by the branch in which the service occurred. A barber may therefore have records for more than one branch in the same period.
- Refund and discount activity may affect shop revenue reporting, but **must not retroactively change barber earned commissions**.

## 5. Biweekly payroll periods

- Configure an explicit **first period start date**. Subsequent periods are contiguous 14-day windows in Asia/Manila.
- Example *only*, subject to owner-selected anchor date: October 1 through October 14 inclusive, then October 15 through October 28 inclusive.
- Never infer semi-monthly cutoffs (1st–15th or 16th–end) from the word *biweekly*.
- Calculate a separate payroll record for each eligible **barber + branch + period**.
- Do not double-count a commission if a draft is regenerated or an operation is retried.
- On period close, allow an authorized user to generate a draft from qualifying, unassigned service commissions.
- Late-arriving eligible services must not silently modify an approved payroll; handle through a documented supplemental or next-period adjustment with source references and approval.

## 6. Payroll workflow and states

1. **Accumulate:** Capture each completed paid service as an immutable commission entry.
2. **Draft:** Generate the biweekly barber payroll breakdown for a selected branch/period.
3. **Pending Approval:** Manager reviews service list, totals, and supported adjustments.
4. **Approved:** Manager approves the amount and locks the approved breakdown.
5. **Paid:** Authorized staff records disbursement details, producing a permanent payment record and payslip.

Allowed state transitions:

- Draft -> Pending Approval
- Pending Approval -> Approved
- Pending Approval -> Draft (rejected/returned with required reason)
- Approved -> Paid

Enforce transitions on the server. A payroll may **not** be marked Paid without Manager approval. Preserve approver ID and timestamp, and do not silently edit Approved or Paid records. Corrections require an audited, separately approved adjustment or follow-up payroll.

For the MVP, record completed external payments; do not assume Barracks directly transfers money to bank accounts or e-wallets.

## 7. Screens and user experience

### Payroll Overview
- Branch selector constrained to the current user's access.
- Current 14-day period and prior periods.
- Total commission payable, number of barbers, pending approvals, and paid payroll records.
- Compact table by barber: completed eligible services, gross commission, adjustments, payable amount, and status.

### Payroll Details
- Barber and branch identity, period dates, approval/payment status.
- Service-level breakdown: service name, source booking/queue/transaction, service date, original price, snapped rate, and commission earned.
- Totals and individually justified adjustments.
- Manager actions: review, submit/return, approve.
- Payment-recording action only after approval.
- Downloadable/printable payslip.

### Commission Settings
- Individual barber rates, current rate, effective date/time.
- Historical rate-change log and who changed each rate.
- Changes only affect future completed services.

### Payroll History
- Search/filter by period, barber, branch, and status.
- Preserve paid records and approvals for later auditing.
- Restricted payroll visibility based on staff role and assigned branches.

## 8. Access control

| Action | Administrator | Manager | Front Desk |
| --- | --- | --- | --- |
| View payroll | All permitted branches | Assigned branches | No |
| Set barber commission rate | Yes | Yes, where existing role rules permit | No |
| Generate/review drafts | Yes | Assigned branches | No |
| Approve payroll | No by default; owner specifies **Manager** | Yes, assigned branches | No |
| Record approved payroll as paid | Yes | Yes, assigned branches | No |
| View/download payslips | Yes | Assigned branches | No |

Use existing Barracks authentication, role checks, and branch-scope utilities. All reads and mutations must validate permissions server-side, including direct API access. Do not expose payroll through Front Desk navigation.

If Administrator approval is desired later, that is a separately authorized business rule change, not an implicit exception.

## 9. Proposed data model (implementation design, not existing schema)

Names may be adapted to the actual database after inspecting migrations and current transaction/service entities.

### barber_commission_rates
- id, barber_id, commission_rate, effective_at, changed_by, change_reason, created_at
- Immutable history for effective-dated individual rates.

### barber_commission_entries
- id, barber_id, branch_id, source_transaction_id, source_service_line_id (or unique eligible service identifier)
- service_completed_at, earned_at, original_service_price_centavos
- commission_rate_snapshot, commission_amount_centavos, service_name_snapshot
- created_at, immutable source references
- Unique source service line to prevent duplicate commission accrual.
- Keep the earned entry intact after a subsequent refund.

### payroll_periods
- id, branch_id, period_start, period_end_exclusive, created_at
- Enforce unique branch + period, no overlapping periods for the same payroll calendar.

### payroll_records
- id, payroll_period_id, branch_id, barber_id, status
- gross_commission_centavos, total_adjustments_centavos, payable_centavos
- submitted_at, approved_by, approved_at, paid_at, created_at, updated_at
- Unique barber + branch + period for normal payroll; define a separate link/type for approved supplemental records if later supported.

### payroll_adjustments
- id, payroll_record_id, signed_amount_centavos, reason, created_by, created_at
- Corrections need a reason, author, and approval visibility.
- Adjustments must never serve as an untracked way to overwrite historical commission snapshots.

### payroll_payments
- id, payroll_record_id, amount_centavos, paid_at, payment_method, optional reference, recorded_by
- MVP may restrict to a single full disbursement per payroll record; partial payments require a separately designed workflow.

Prefer immutable audit events for approval, rejection, and payment recording. Use foreign keys to existing barbers, branches, transactions, and staff/user tables, rather than duplicating those master records.

## 10. Integration contracts

- **Bookings / Queue:** Identify the actual barber and services performed. Booking creation, queue check-in, and in-progress statuses do not accrue commission.
- **Payments:** Link to the authoritative completed and paid visit/service lines and original price snapshots. Trigger/ensure idempotent commission capture when payment qualifies a completed service.
- **Barber management:** Read the commission rate in effect at service completion and expose an authorized rate-history editor.
- **Branches:** Use source service/transaction branch ownership, not the barber's current branch; a transfer must not reattribute earlier earnings.
- **Attendance:** May appear as contextual information but does **not** automatically change commission in this commission-only MVP.
- **Refunds:** Existing refund workflows must not delete or reverse earned commission entries; show the refund status separately if helpful for audit.
- **Reports:** Distinguish service sales/revenue (which can be reduced by discounts and refunds) from accrued barber commission (which uses original prices and survives refunds).

Avoid duplicate writes when transaction payments are retried, web requests time out, or draft generation runs repeatedly. Design payment and commission recording to be transactionally consistent.

## 11. Payslip requirements

Each payslip should show:

- Shop/branch name and barber name
- Payroll period dates and payment date
- Total eligible services
- Gross commission
- Itemized adjustments, if any
- Total payable and total paid
- Payment method/reference (if recorded)
- Manager approver and approval timestamp
- Optional detailed commission/service breakdown

Do not include tips, because barbers receive them directly.

## 12. Acceptance criteria

1. **Original price:** Given a PHP 250 original service price, PHP 50 discount, and 40% rate, when the completed service is paid, the commission is PHP 100.
2. **Refund retention:** Given that PHP 100 commission is earned, when its transaction is later refunded, the commission remains PHP 100 and is not reversed.
3. **Rate changes:** Given a barber's rate changes from 40% to 45%, earlier completed services remain at 40% while later completed services use 45%, regardless of when payroll is generated.
4. **Individual rates:** Two barbers on the same original-price service earn amounts based on their individually snapped rates.
5. **No premature accrual:** Unpaid, cancelled, no-show, or unfinished services do not generate earned commission.
6. **No duplicates:** Reprocessing a checkout or regenerating a draft does not create duplicate entries or double payroll.
7. **Biweekly boundaries:** A qualifying timestamp exactly at a period boundary appears only in the new 14-day period in Asia/Manila.
8. **Approval enforcement:** Payroll cannot reach Paid without Manager approval and recorded approval identity/time.
9. **Branch security:** A Manager cannot read, approve, or pay payroll outside assigned branches.
10. **History stability:** Later service-price edits, rate edits, barber branch transfers, and customer refunds do not alter existing commission snapshots.
11. **Auditability:** Every payroll status change, manual adjustment, and payment recording has actor and timestamp; approved history is not silently overwritten.
12. **Tips exclusion:** Direct tips do not appear in earnings totals or payslips.

## 13. Excluded from MVP

- Tip tracking or tip pooling
- Base salary, hourly wage, overtime, and attendance-based wage computation
- Automated bank/e-wallet disbursement
- Barber self-service login
- Automatic statutory deduction computation, pending employment/payroll classification and compliance review
- Unapproved manual commission recalculation

**Compliance note:** Commission-only compensation does not automatically remove obligations under Philippine labor, tax, and social-contribution rules. Employment classification, lawful pay floors, statutory contributions, withholding, and required recordkeeping must be reviewed separately before production payroll is relied on.

## 14. Implementation checklist

- [ ] Confirm payroll anchor date, source event eligibility, and post-payment void policy.
- [ ] Inspect existing schema for transaction item/service price snapshots, refund behavior, and barber commission fields.
- [ ] Create backward-compatible migrations and enforce uniqueness/branch ownership.
- [ ] Implement rate history and immutable per-service commission snapshots.
- [ ] Implement idempotent earning accrual on successful completion + payment.
- [ ] Implement 14-day period generation, draft review, and manager-only approval.
- [ ] Implement paid recording, printable payslips, audit trail, and history.
- [ ] Add focused tests for refunds, historical rates, period boundaries, duplicate processing, and branch permissions.
- [ ] Run migration/data reconciliation checks before deploying.

## 15. Still to confirm with the owner

The following decisions are not invented or silently assumed in this specification:

1. **Payroll anchor date:** The date the first 14-day cycle begins.
2. **Exact paid qualification event:** Confirm how completion and successful payment are represented in existing Barracks service/transaction records.
3. **Post-payment voids:** Whether an already-earned commission is kept when a previously paid transaction is voided (refund retention is confirmed; void treatment is distinct).
4. **Payment methods and corrections:** Which payout methods the shop uses and whether full-only disbursement is acceptable for MVP.

All other commission, discount, refund, rate-change, tip, cadence, manager approval, and branch-ownership rules above are confirmed.
