# Phase 7: branch-aware reports and dashboard aggregates

Branch: `feat/multi-branch-foundation`. Phase 7 only; customer branch selection/booking remains Phase 8.

## 1. Files changed

- `README.md`, `PHASE7_REPORT.md`
- `barracks-pwa/server/auth/report-branch-access.ts`
- `barracks-pwa/server/services/revenue-report.service.ts`
- `barracks-pwa/server/services/inventory-report.service.ts`
- `barracks-pwa/server/services/dashboard-report.service.ts`
- `barracks-pwa/app/api/reports/revenue/route.ts`
- `barracks-pwa/app/api/reports/inventory/route.ts`
- `barracks-pwa/app/api/reports/dashboard/route.ts`
- `barracks-pwa/app/components/ReportBranchScope.tsx`
- `barracks-pwa/app/utils/use-branch-context.ts`
- `barracks-pwa/app/pages/PageRouter.tsx`
- `barracks-pwa/app/pages/admin/AdminDashboard.tsx`
- `barracks-pwa/app/pages/admin/ManagementReports.tsx`
- `barracks-pwa/app/pages/admin/RevenueReports.tsx`
- `barracks-pwa/app/pages/admin/InventoryReports.tsx`
- `barracks-pwa/app/pages/staff/StaffDashboard.tsx`
- `barracks-pwa/tests/revenue-report.test.ts`
- `barracks-pwa/tests/reports-ui.test.tsx`
- `barracks-pwa/tests/staff-dashboard-queue.test.tsx`
- `barracks-pwa/tests/permission-routes.test.ts`

## 2. Reports and services

Shared server scope resolution accepts a positive numeric `branchId`, Administrator-only `all`, or omitted selection for accessible-branch aggregation. Revenue filters each leg of its existing event stream by the transaction snapshot. Existing summary, daily, service, barber and payment-method breakdowns remain intact.

Inventory calculations are extracted from the route to an authorized service. Valuation follows item ownership; movement usage follows movement ownership, grouped by numeric branch and item without multiplying events when branch labels differ. Historical movements may belong to a branch other than the current item; they remain reportable without exposing the item's foreign current stock/threshold. Supplier spending and distinct received-delivery counts follow restock header ownership, including legacy lines with a different item branch. Suppliers without received deliveries in scope are omitted.

No new analytics or migration was added. The active reports/dashboard surfaces have no attendance aggregate; attendance management and persisted attendance ownership remain unchanged.

## 3. Dashboards and UI

The management dashboard uses `GET /api/reports/dashboard` to calculate its existing aggregates in PostgreSQL: inventory valuation, low stock, open restocks, today's/upcoming bookings, active barbers, customers with visits and recent received deliveries. Bookings are counted by their saved branches regardless of current barber assignment. The current barber roster uses barber ownership.

Customer identities have no branch column. The scoped customer count uses distinct customers referenced by branch-owned bookings or queue records and is labeled **Customers with visits**. The same customer counts once in the global view even with visits in multiple branches. Existing customer visibility excludes deactivated linked customer accounts.

Front Desk keeps its existing booking/queue/barber metrics and reads their existing APIs with the selected branch. It gains no financial/inventory permissions. Both dashboards and reports use the existing context. Administrator management surfaces distinguish **All branches (global)** from **Branch view**. Branch changes remount content, clear data and filters (including report dates/type), and cleanup ignores superseded responses and late errors. The context loading state distinguishes loading from no assigned branches.

## 4. Authorization

All three management reporting APIs preserve Administrator/Manager role gates; services enforce the same gates. Managers can select only assigned branches; missing scope aggregates only assigned branches, and an empty assignment returns zero/empty results rather than dropping SQL filters. Explicit unauthorized branch/global requests return 403. Front Desk, customers and suppliers cannot access management aggregates. The new dashboard route is included in the existing anonymous/disallowed-role matrix.

## 5. Aggregate calculation rules

- Gross sales: original completed sales in the period, including those subsequently reversed, owned by `transactions.branch_id`.
- Reversed amount: refund/void ledger actions in the period, attributed through their immutable transaction. Legacy reversed transactions use the saved sale date only when no action exists.
- Net revenue: gross minus reversals. Counts increment only for sale events. Tender amounts, cash/change and `barbers.revenue` do not supply financial totals.
- Checkout/reversal dates and transaction-name breakdowns preserve the existing Manila date/snapshot rules.
- Global totals query the union of branches once. Shared suppliers are grouped once; received deliveries use distinct request IDs. Distinct customer identities are not added branch-by-branch.
- Inventory valuation is current stock, independent of report dates. Movement/spending comparisons retain their existing period behavior and line-cost fallback.

## 6. Focused tests

The extended revenue/report tests cover the requested six acceptance boundaries: different branch totals, global totals without double-counting, unauthorized Manager service/API denial, branch-owned refund/void effects, inventory/restock isolation and a report branch-switch DOM test with a delayed stale response. They also cover no assignments, multiple assigned branches, historical barber moves and preserved legacy movement/restock ownership. Existing staff dashboard tests now provide context and assert scoped request behavior.

Development focused runs passed (latest: 10 passed, 0 failed, 0 skipped). Final verification results follow below.

## 7. Final verification

Database tests loaded `.env.local` without printing credentials and used disposable PostgreSQL schemas. No shop-database migration or browser session was performed.

- Final focused tests: **16 passed, 0 failed, 0 skipped** across `tests/revenue-report.test.ts`, `tests/reports-ui.test.tsx`, `tests/staff-dashboard-queue.test.tsx` and the extended `tests/permission-routes.test.ts` role matrix.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with two unused suppression warnings. Both directives were removed; a targeted `npx eslint app/pages/admin/RevenueReports.tsx app/pages/admin/InventoryReports.tsx` repair check passed without warnings.
- `npm run build`: passed, including Next.js production TypeScript checking and the new dynamic dashboard report route.
- `git diff --check`: passed.
- Full `npm test`, run **once**: **132 tests, 131 passed, 1 failed, 0 skipped**. The only failure is the unchanged attendance assertion at `barracks-pwa/tests/attendance.test.ts:72`: expected `23503`, actual `23001` from the existing RESTRICT foreign key. Attendance source/tests were not modified.
- The corrected Phase 6 migration-count assertions passed in that full run: all **7 tests in `tests/booking-migration.test.ts` passed**, including fresh-schema counts and legacy conflict rollback checks. No migration-count failure remains.

No full-suite rerun was performed. The branch is ready for review with the documented attendance baseline.

## 8. Remaining Phase 8 scope

Customer-facing branch selection and the customer booking flow only: choose an available branch, load its barber/scheduling options and submit branch-owned customer bookings. Current customer booking behavior stays on Main Branch. Inventory transfers, new analytics and new payment functionality remain deferred.
