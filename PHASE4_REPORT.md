# Phase 4: payment and transaction branch ownership

Branch: `feat/multi-branch-foundation`. Phase 4 is a separate local commit. No cherry-pick, push or merge is performed.

## 1. Files changed

Paths are relative to the repository root:

- `README.md`
- `PHASE4_REPORT.md`
- `barracks-pwa/server/db/migrations/025_transaction_branches.sql`
- `barracks-pwa/server/services/payment.service.ts`
- `barracks-pwa/app/api/transactions/route.ts`
- `barracks-pwa/app/pages/staff/PaymentPage.tsx`
- `barracks-pwa/tests/payment-foundation.test.ts`
- `barracks-pwa/tests/payment-actions.test.ts`
- `barracks-pwa/tests/payment-ui.test.tsx`
- `barracks-pwa/tests/branch-barber-api.test.ts`
- `barracks-pwa/tests/booking-migration.test.ts` (migration-count expectations only)

## 2. Migration

Migration 025 adds required `transactions.branch_id`, a branch foreign key using `ON DELETE RESTRICT`, and one branch/creation-time index supporting scoped history. Existing records receive Main Branch. Tenders and financial actions already have required transaction links and inherit branch ownership through those links; they receive no redundant branch columns.

The existing finalized financial guard would reject the new-column backfill. The migration disables that guard and the transaction/action consistency trigger within the existing transactional migration runner, backfills ownership, drains remaining deferred financial checks, and restores both guards before commit. Pre-action historical reversals legitimately have no audit entries, so branch-only backfill must preserve them without invoking the newer reversal validation or fabricating audit entries. No sale/tender snapshots, original amounts, statuses, receipt references, timestamps or audit entries are rewritten.

A preflight rejects already-existing transactions linked to non-Main visits, reporting transaction IDs. This avoids silently creating inconsistent ownership when Main Branch backfill and an existing visit's ownership disagree; those historical cases require review before migration can complete. No financial records are automatically reconciled or deleted.

A database trigger rejects booking/queue branch disagreement on inserts and linked-visit updates, and prevents transaction branch changes. Existing nullable visit links may still clear when related records are deleted; the financial record retains its branch.

Migration was tested only on disposable PostgreSQL schemas. It was not applied to the shop database.

## 3. Transaction/payment branch behavior

The inspected branch already contains completed-visit checkout, cash received/change, other payment methods, immutable transaction/tender snapshots, server-backed receipt lookup, paginated history, full refunds/voids and append-only financial audit history. This phase scopes that existing implementation. It does not import payment work from other branches or add payment features.

Booking checkout reads and locks the booking and copies its branch into the transaction. Walk-in checkout reads and locks the accountless/registered customer's walk-in queue entry and copies its branch. Appointment-linked queue entries continue to use booking checkout identity. The request schema rejects client-supplied ownership fields; a query branch cannot override the visit's persisted branch. Cash calculations, one-transaction-per-visit concurrency guards and the single balanced tender remain intact.

Refunds/voids authorize the locked transaction's branch while retaining full-amount validation, atomic sale/tender status changes and immutable audit history.

## 4. Authorization and UI

Checkout and refund/void services resolve the staff member's actual persisted role and require access to the source visit/transaction branch inside their existing transaction and staff-row lock. Administrator access is global; Managers/Front Desk require assignment. Existing role permissions remain: Front Desk checkout API/UI, management financial actions and transaction history.

Eligible-visit, history (including total/page counts) and receipt-reference reads accept `branchId` and authorize it. Without a branch parameter, Administrators receive global results; Managers/Front Desk receive only accessible branch records. An empty membership list returns no records. Foreign reference lookups return 404, and an explicit unauthorized branch returns 403. Financial audit visibility remains management-only.

PaymentPage uses the existing branch context. Selected-branch eligible visits, history and receipt requests reload when switching. A keyed workspace resets checkout selection, cash inputs, page/filter state, completed-payment summaries, receipts and financial-action forms. Old responses update only the unmounted workspace and cannot repopulate the new branch's data. Existing layout and payment controls are retained.

## 5. Focused tests

Initial final focused run: **28 tests passed, 0 failed, 0 skipped**. After the full suite exposed the legacy reversal compatibility issue, the repaired focused run included existing revenue regression tests and finished with **33 passed, 0 failed, 0 skipped**, using existing suites:

- `payment-foundation.test.ts`: existing checkout/snapshot/concurrency/cash/migration coverage; explicit Main staff assignments; strict ownership-input rejection; one new migration test compares a refunded sale, tender and audit entry before/after backfill and confirms finalized protection is restored.
- `payment-actions.test.ts`: existing refund/void authorization, concurrency, rollback and history tests with explicit staff branch assignments.
- `payment-ui.test.tsx`: existing checkout/receipt/history controls adapted to branch context; one new switch test proves eligible visits/history change and the old receipt clears.
- `branch-barber-api.test.ts`: one new Phase 4 integration test proves booking/walk-in inheritance, unauthorized Manager/Front Desk reads and creation, foreign refund denial, Administrator reads across Main/second branches, and database rejection of booking/queue ownership mismatches.
- `booking-migration.test.ts`: migration count changes from 24 to 25; existing migration tests pass.
- `revenue-report.test.ts`: unchanged implementation/tests exercised after the migration compatibility repair, including preservation of pre-action historical reversals. No branch reports were added.

During development, the first focused run caught pending deferred trigger events blocking an ALTER TABLE after backfill. The migration now drains those events before restoring protection; repaired migration tests and the final focused run pass.

## 6. Final verification

| Check | Result |
| --- | --- |
| Final focused tests after repair | 33 passed, 0 failed, 0 skipped |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `git diff --check` | Pass |
| Full `npm test` (one run at end) | 124 tests: 122 pass, 2 failures; details below |

The full suite was run exactly once: 124 tests, 122 passing, two failures. The known attendance assertion at `barracks-pwa/tests/attendance.test.ts:66` still expects PostgreSQL `23503`, while the existing RESTRICT foreign key returns `23001`; attendance code and tests remain unchanged. The other failure was migration backfill invoking newer audit validation on pre-action reversed transactions (`revenue-report.test.ts:69`). Migration 025 was repaired to preserve those historical records; the affected test and all 33 focused tests pass afterward. The full suite was not rerun, so its recorded result remains 122/124.

TypeScript, lint and build each ran once and passed. The subsequent compatibility repair changed only migration SQL and documentation; SQL behavior was verified by the repaired focused run. Final diff checks pass.

No manual browser or shop-database verification was performed. UI evidence comes from DOM tests; database evidence comes from disposable schemas. The pre-existing untracked `.DS_Store` is preserved and excluded from the commit.

## 7. Remaining Phase 5 scope

Attendance branch ownership is the next deferred operational domain. Inventory/restock branch ownership, branch reports/dashboard aggregates and customer branch selection also remain deferred. None of these domains is implemented or refactored in Phase 4. Existing refunds/voids are already present and were only scoped by this phase.
