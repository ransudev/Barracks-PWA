# Phase 6: multi-branch inventory and restocks

Branch: `feat/multi-branch-foundation`. Phase 6 is committed separately from the earlier multi-branch phases. The shop database was not migrated, and no push or merge was performed.

## 1. Files changed

- `PHASE6_REPORT.md`
- `README.md`
- `barracks-pwa/app/api/inventory/[id]/movements/route.ts`
- `barracks-pwa/app/api/inventory/[id]/route.ts`
- `barracks-pwa/app/api/inventory/[id]/threshold-history/route.ts`
- `barracks-pwa/app/api/inventory/alerts/[id]/acknowledge/route.ts`
- `barracks-pwa/app/api/inventory/alerts/route.ts`
- `barracks-pwa/app/api/inventory/route.ts`
- `barracks-pwa/app/api/reports/inventory/route.ts`
- `barracks-pwa/app/api/restocks/[id]/delivered/route.ts`
- `barracks-pwa/app/api/restocks/[id]/receive/route.ts`
- `barracks-pwa/app/api/restocks/route.ts`
- `barracks-pwa/app/api/suppliers/[id]/route.ts`
- `barracks-pwa/app/lib/api.ts`
- `barracks-pwa/app/pages/admin/RestockManagement.tsx`
- `barracks-pwa/app/pages/staff/InventoryPage.tsx`
- `barracks-pwa/server/auth/inventory-branch-access.ts`
- `barracks-pwa/server/db/migrations/027_inventory_restock_branches.sql`
- `barracks-pwa/server/schemas/sprint2.schema.ts`
- `barracks-pwa/server/services/inventory-alert.service.ts`
- `barracks-pwa/server/services/inventory-movement.service.ts`
- `barracks-pwa/server/services/inventory.service.ts`
- `barracks-pwa/server/services/restock.service.ts`
- `barracks-pwa/server/services/supplier.service.ts`
- `barracks-pwa/tests/booking-migration.test.ts`
- `barracks-pwa/tests/inventory-branch-ui.test.tsx`
- `barracks-pwa/tests/payment-foundation.test.ts`
- `barracks-pwa/tests/sprint2.integration.test.ts`

## 2. Migration

`027_inventory_restock_branches.sql` adds required branch foreign keys to inventory items, inventory movements and restock headers, with restricted deletion and branch indexes. Exact, unambiguous case-insensitive matches to an existing branch name/code retain identified ownership; unknown or ambiguous labels fall back to Main Branch. Each movement/restock is backfilled from its own historical label rather than a related entity's current ownership. Existing labels, quantities, timestamps, headers and child records remain intact. Text snapshots are widened to the branch-name limit of 160 characters.

SKU uniqueness becomes case-insensitive within each branch. Item and restock branch ownership is immutable. New movements snapshot their item's branch in a database trigger, reject contradictory ownership and retain it permanently. New restock lines must belong to the header's branch; their parent/item links cannot change. Existing legacy lines are retained even where the old labels disagree; receiving rejects a stock row outside the header's branch rather than modifying another branch's inventory.

Apply through `npm run db:migrate` before using Phase 6 in the shop. Migration verification used disposable PostgreSQL schemas only.

## 3. Inventory ownership

Each branch has separate inventory item/stock rows; the same product and SKU can have independent quantities, costs and thresholds in different branches. Numeric ownership is authoritative. Legacy branch text remains accepted in payloads for compatibility but cannot determine or change ownership. Metadata edits never move stock. RECEIVE, USE, CUSTOMER_PURCHASE, STAFF_USAGE, DAMAGE, DISCARD, RETURN and ADJUSTMENT operate only on the locked, authorized item.

Threshold histories and alert acknowledgements inherit numeric ownership from their permanently owned stock row, so they do not receive redundant branch columns. Their existing text snapshots remain. Items referenced by movements, restocks or threshold history are deactivated instead of deleted.

## 4. Restocks and suppliers

Restock headers belong to a branch; lines inherit that immutable ownership. Creation validates both supplier linkage and branch ownership. Receiving authorizes and locks the header, validates every line exactly once, locks matching stock by item/supplier/branch, updates that stock and records RECEIVE movements in the same transaction. Duplicate receiving remains rejected. Supplier status transitions also lock their request to serialize with staff delivery/receiving actions.

Supplier identities/accounts remain global. The linked supplier portal retains access to that supplier's records across branches; other suppliers cannot operate its requests. Management supplier detail reads include only authorized branch stock/restocks. Existing inventory reports filter ownership to authorized branches; no new branch report aggregates or selectors were added.

## 5. Authorization and UI

Collection requests accept `?branchId=...`; omitted selection resolves the existing primary/first accessible branch. ID reads/writes authorize persisted item/restock ownership, hold the row lock through the operation and reject a conflicting selected branch even for an Administrator.

Existing role gates remain: Administrator/Manager operate inventory and restocks, only Administrator deletes inventory, and Front Desk has no inventory/restock operation permission. Managers are assigned-only and Administrators may select any existing branch. Movement history, thresholds, alerts, receiving, supplier operational detail and existing report reads cannot bypass branch authorization.

Inventory and Restock pages use `useBranchContext`, request selected-branch data and remount their workspace on selection changes. This clears drafts, filters, dialogs and selections. Removed workspaces ignore response data and suppress late toasts; stale work cannot populate the new branch. Restock item options use scoped numeric ownership rather than comparing historical branch labels.

## 6. Focused tests

Final focused run: **4 passed, 0 failed, 0 skipped**.

```sh
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/sprint2.integration.test.ts tests/inventory-branch-ui.test.tsx
```

The extended supplier/inventory integration tests cover separate quantities for the same SKU, purchase deductions, target-only restocking, Manager/Front Desk denial, Administrator access, forged selected-branch/record combinations, supplier/report read filtering, historical snapshots and immutable ownership. A migration test compares every original field before/after backfill and verifies retained legacy child records. One DOM test exercises both inventory/restock branch changes, dialog resets and a delayed old-branch history response.

## 7. Final verification

The database environment was loaded from `.env.local` without printing credentials.

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full `npm test`, run **once**: **129 tests; 123 passed, 6 failed, 0 skipped**. Five failures were migration-count assertions still expecting 26 migrations. They were corrected to 27, and only `tests/booking-migration.test.ts` was rerun: **7 passed, 0 failed, 0 skipped**. The full suite was not rerun.
- Remaining known baseline: `tests/attendance.test.ts:72` expects PostgreSQL `23503` but the unchanged RESTRICT foreign key returns `23001`. Attendance code/tests were not changed by Phase 6.

No browser session or shop-database migration was performed. UI verification was DOM-based; API/stock/migration verification used real PostgreSQL in disposable schemas.

## 8. Remaining Phase 7 scope

Branch revenue/report aggregates, dashboard branch aggregates and customer-facing branch selection remain deferred. Inventory transfers remain unsupported and were not introduced.
