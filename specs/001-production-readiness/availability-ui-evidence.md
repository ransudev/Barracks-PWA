# Local availability UI/API evidence

Date: 2026-10-11, Asia/Manila. Local source/jsdom/API evidence for T019 and P0 SC-003/FR-017; authenticated rendered-browser acceptance remains a separate gate.

The noncustomer `/api/barbers` GET response now appends the server operational eligibility to each already branch-authorized record. Customer projection is unchanged. `ApiBarber`/`ApiBarberAvailability` expose an optional serializable `operationalAvailability` field for compatible callers. Its `available`, stable `reason`, active-entry ID and attendance state feed the floor/dashboard/queue. Shared labels show absence, clock-out, in-service, off-shift, scheduled break, time away, duration review and reservation conflict without converting Unmarked to absence.

Barber Floor reloads barbers, active queue and attendance after successful status/attendance changes. Branch selection invalidates earlier loads and clears prior branch data; loading/error metrics do not show old successful counts as current. Clock Out is disabled during an active service with an instruction to complete it first. Dashboard counts available barbers and displays server reasons. Queue suggested assignment filters on server availability, disables manual starts for blocked assigned barbers with their reason, offers Refresh availability, and reloads availability after committed queue changes. Full visit interval eligibility remains checked server-side when starting; these summaries describe the current floor and do not promise that any selected service fits a future block.

Read installed Next documentation for client/server components and route handlers before implementing. Existing client effects/state and server-only database imports are retained.

Executed final focused UI regression command from `barracks-pwa`:

```powershell
node --import tsx --experimental-test-module-mocks --test --test-concurrency=1 tests/barber-floor-ui.test.tsx tests/queue-next-customer-ui.test.tsx tests/staff-dashboard-queue.test.tsx
```

Result: **16 passed, 0 failed, 0 skipped**. Meaningful added checks verify raw Available plus authoritative Absent remains blocked until an attendance action refreshes server availability; both status/attendance actions refetch; clocked-out Queue barber cannot manually start or enter suggested assignments; dashboard availability count and reason follow the authoritative field. Existing branch-switch, role-specific floor, suggestion confirmation, quick walk-in, duplicate-submission and empty/error checks also passed.

Earlier combined UI/API run including `tests/branch-barber-api.test.ts` passed **17/17, zero skipped** against the isolated PostgreSQL target. Added API assertions require the operational payload on branch-scoped staff roster reads; their final DB rerun belongs to the parent’s synchronized suite because the parent is stabilizing migration/extension concurrency.

Targeted ESLint on changed API/helper/UI and related tests passed. The parent owns README synchronization, server eligibility/attendance/interval code, full database regressions, build/type/lint checks and authenticated browser evidence. This file does not claim those independent gates passed.

Final parent gates passed: [E05/E06](evidence.md), [browser-evidence.md](browser-evidence.md). The aggregate suite includes final branch-barber API assertions. This supplements the focused results above.
