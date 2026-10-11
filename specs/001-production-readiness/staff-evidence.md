# Staff authorization evidence

Date: 2026-10-11, Asia/Manila. Stage 3, FR-003 / SC-002.

## Baseline

Source inspection confirms that `GET /api/users` loads every active staff account and filters only by role. Detail, update, lifecycle and delete routes authorize target role before the transaction; `user.service.ts` does not load actor/target memberships or recheck the actor under lock. A Manager can therefore target any Front Desk account regardless of branch. This is a source-confirmed authorization gap; no hosted mutation was attempted.

`branch.service.ts` already locks the target `users` row before every membership change. Staff account transactions can use the same row-lock protocol to serialize membership revocation and account changes. Existing role policy prevents Administrators from changing other Administrator accounts and prevents self lifecycle/deactivation; preserve those restrictions and existing last-administrator guards.

## Implementation

The owner accepted draft D01 on 2026-10-11. Manager reads use assigned-branch overlap, disclose only authorized membership IDs, and permit global mutations only when every target membership is authorized. Unassigned and wider shared accounts require Administrator management. Existing role/self/Administrator protections remain in force.

`user.service.ts` now supplies staff-specific list/detail/create entrypoints and requires the authenticated actor ID for sensitive account mutations. Mutations acquire the existing Administrator advisory guard, lock actor and target user rows in ID order, then read current roles, lifecycle, and memberships. Membership writes lock the same user rows; administrator-only assignment routes now pass their authenticated actor for in-transaction revalidation. Bootstrap account creation remains an internal seed path; HTTP staff creation always uses `createStaffUser`.

Manager account creation and initial `user_branches` inserts commit atomically. `branchIds` is an additive staff-create field (unique positive IDs; maximum 100; omitted defaults to empty for existing Administrator callers). Managers must supply at least one explicit authorized branch. The first selected branch becomes primary. Administrator accounts remain global with no initial branch assignments.

Staff list/detail and successful mutations add `branchIds` and `canManageAccount` response metadata. Foreign/unassigned Manager detail lookups return 404; visible wider shared mutations return 403. The existing Staff screen uses the server scope metadata to hide global actions for shared accounts and supplies explicit initial branch checkboxes during creation. It retains its existing role restrictions and layout. Branch choices come from the staff collection response and are authorized against the actor's current persisted role/memberships.

## Verification

- The initial staff/role/UI suite passed 4/4 against the local disposable PostgreSQL database, with zero skipped tests.
- After adding shared-account read-only UI and required initial-branch coverage, `staff-management-ui.test.tsx` passed 3/3.
- `npx tsc --noEmit` and targeted ESLint for all changed Stage 3 service/schema/API/UI/tests passed.
- A combined staff/branch/lifecycle run passed 6 scenarios but its unrelated lifecycle suite failed during migration setup with PostgreSQL 42704 (`referenced operator class was concurrently dropped`). This was a shared disposable-database extension harness race, before lifecycle assertions executed. The helper was subsequently repaired; the final complete suite passed.
- Final accepted-policy regression execution and authenticated browser evidence are recorded below when available.

No schema migration is required because `user_branches` already exists. No hosted mutation was attempted. T013–T016 are complete locally; final evidence follows.

Final acceptance: [E04–E06](evidence.md), all 154 aggregate tests passed with zero skips on source 523a97f. The extension harness race was repaired with serialized migration/extension setup. Manager shared/local/foreign/unassigned browser checks passed; see [browser-evidence.md](browser-evidence.md). T013–T016 complete locally.
