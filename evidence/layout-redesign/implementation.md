# Operational layout evidence

Branch: `layout-redesign`. Baseline captured 2026-10-04 in the running app at localhost:3000, desktop 1440 × 1000 and mobile 390 × 844. Existing Sora/Inter typography, monochrome surfaces, red action accent, shared controls and drawers are retained.

## Data map and baseline findings

| Task | Authoritative source | Available data / constraint |
| --- | --- | --- |
| Bookings day schedule | `/api/bookings` | Date, time, endTime, durationMinutes, service/customer/barber snapshots, status; drawer actions stay unchanged. Existing list omits accountless bookings through its user join: current UI shows 44 records. Do not infer unseen bookings. |
| Scheduling | schedule.service, `/api/barbers/:id/schedule`, `/api/shop-hours` | Weekly shifts, breaks and timestamped time away. Schedule endpoint is management-only. A read-only staff schedule projection is needed for the day view; editing authorization stays management-only. |
| Availability | booking-availability.service, BookingForm | Server validated slots remain the only bookable availability. Blank calendar space is never offered as a slot. Demo shop hours have duplicate weekdays and GET returns 409; this remains a visible limitation. |
| Checkout / ledger | `/api/transactions?view=eligible`, history, reference lookup | Authoritative completed unpaid visits and prices; checkout remains front-desk-only, financial actions management-only. Saved receipt and audit history remain authoritative. |
| Management activity | dashboard/management, revenue-report.service | Existing financial report already aggregates sales and dated refund/void events using Manila boundaries. Reuse it for an additive overview field; scope is all branches accessible to management. No profit estimate. |
| Attendance | attendance/history, corrections | Recorded status and clocks, correction history, management correction controls. Missing record means Unmarked, never Absent. Existing schema accepts date/barber/status; monthly view may filter the authorized history read locally. |
| Restocks | restock.service | Pending → Accepted → Preparing → Shipped (supplier); Shipped → Delivered and Delivered → Received (management). Supplier may cancel before shipping. There is no Rejected backend status. Receiving updates stock transactionally. |

## Visual direction

Bookings is the representative screen: a day time axis, barber columns, readable appointment blocks, supporting schedule constraints, and an agenda for mobile. Shared filters and freshness connect the screens without forcing the same composition. Checkout pairs eligible visits with payment, transactions use a ledger, attendance uses a month matrix, and restocks use grouped requests at the observed volume of 10 active requests.

Baseline PNGs in this folder capture dashboard, attendance, restocks, transactions, schedules, front desk and bookings in both viewports. Shop-hours ambiguity is a data/environment blocker, not a reason to remove validation or apply a migration.

## Implemented structure and verification so far

- TypeScript (`npx tsc --noEmit`) passed after stages 2–6 changes. Targeted ESLint passed for the shared shell, Bookings, DaySchedule, ScheduleManagement, StaffDashboard and PaymentPage. No automated tests were run.
- Front Desk demo sign-in succeeded with the current seeded `.app` account domain; README's older `.local` account domain did not authenticate. No credential or account changes made.
- Bookings: filtered to Miko Reyes, opened Ana Mercado #2 at 10:00–10:45 using the calendar block, observed current authorized Edit/Check In/No Show/Cancel controls. Drawer screenshot: `bookings-lookup-desktop.png`. Source uses authoritative stored duration and interval lanes for overlap; many-barber lookup has an explicit Barber filter.
- Checkout: selected completed unpaid demo walk-in #7 (Enzo Castillo), entered PHP 500 against PHP 300 due, observed PHP 200 change, confirmed explicitly on mobile, and saved receipt reference TX-1B5BC002564842D3847171E5A2FBE89F. History increased from 143 to 144 transactions; eligibility refreshed. Captures: `checkout-desktop.png`, `checkout-mobile.png`, `checkout-completed-mobile.png`. This changes only the authorized synthetic demo visit.
- Restock presentation choice: grouped list at the observed 10 active requests. It keeps supplier, branch, item summary, true backend status and authorized next action together, avoids a wide board on mobile, and leaves Received/Cancelled in a separate history tab.

## Manual walkthrough outcomes (2026-10-04)

- Weekly schedule: Demo Bajada Monday changed from 09:00 to 10:00, saved and verified, then restored to 09:00–19:30. Native time input was operated with keyboard arrows because browser fill did not update React state. `schedule-edit-mobile.png` proves the saved edit; `schedules-mobile.png` shows the restored timeline. Shop-hours editing remains visibly blocked by the preexisting 409 duplicate-weekday guard.
- Saved receipt: opened the new transaction from front desk and management. Front desk shows receipt/print controls; management additionally shows reason-required refund/void and financial audit history. No refund or void mutation was performed. Escape closes drawers, Enter opens selected records, and shared modal focus handling yields to a modal above its drawer.
- Attendance: Miko Reyes 2026-10-01 corrected Present → Late with a reason; then restored Present with a second reason. Both before/after entries persisted, clocks unchanged. `attendance-correction-desktop.png`, `attendance-restored-mobile.png`. An Unmarked Charlie Irk cell shows no record/clocks/correction controls. Recorded absences and future dates remain distinct. Search with no matching barber shows a true empty-filter state.
- Attendance monthly mobile filter: selecting Absent now shows only Luis Dela Cruz's four October records, preserving his complete monthly pattern (two Absent, one Late, one Present), with a matching count. `attendance-mobile-status-filter.png`.
- Restock: synthetic request #35, DEMO-MAA-NS-DIS-001-RESTOCK, Northstar / Barracks Maa HQ, received 18 bottles at the recorded unit cost. Explicit receiving confirmation preceded the mutation. Request moved Delivered → Received and displays 18 requested / 18 delivered; inventory DEMO-MAA-NS-DIS-001 now displays 24 bottles. `restock-receive-confirm-mobile.png`, `restock-received-detail-mobile.png`, `restock-inventory-mobile.png`. This intentionally persists the authorized demo receipt and inventory increase.
- Management exception links: Bajada Amore Pomade selects the exact branch and item (SKU DEMO-BAJADA-BRX-001, quantity9); request#32 opens Bangkal's correct Shipped request. `management-stock-link-desktop.png`, `management-request-link-desktop.png`.
- Realistic overview: all branches, Sep28–Oct4 Manila, 7days inclusive; paid/net PHP13,500,35paid visits, no reversals in this period. Oct4's PHP300 new checkout appears in the daily totals. Receiving request#35 removes it from actionable restocks and removes disinfectant Maa from low stock. Active roster is not an on-duty count.

## Checks and remaining limits

- `npx tsc --noEmit`: passed. Targeted ESLint across all changed TS/TSX targets: passed. `npm run build`: passed (compile, TypeScript, prerender). `git diff --check`: passed. Automated tests were neither created nor run under repository policy.
- Impeccable static detector ran once over the redesigned targets: no findings (`detector.json`). Fresh screenshot/source review completed: ship verdict pass on all three listed material fixes; see review.md. Several mixed-size viewport captures were replaced with settled viewport images; first direction screenshots are historical and final Bookings captures supersede them.
- Availability-dependent create/edit/check-in/start walkthroughs remain pending: configured branch-specific shop hours produce multiple weekday schedules, which this version explicitly rejects. Resolving that requires separately scoped branch-aware scheduling work or a compatible disposable database. No guard bypass, migration, or schema mutation was performed.
- Current bookings API excludes accountless customer bookings through its existing join; calendar faithfully shows its returned records. Overlap/unknown duration/unassigned handling is source-reviewed, but representative live records for those edge cases were not available. No fixture or business rule was changed to fabricate them.
- Receipt print CSS was adapted for drawer ancestors, but an actual printer/output PDF was not inspected. Arbitrary network-failure injection and exhaustive role/state permutations were not performed; actual shop-hours error, loading, empty-filter states and front-desk/management controls were checked.

## Local delivery

Implementation savepoint: `a0a59b0` (`feat: add task-focused operational layouts`). Final UI review scored calendar summary, attendance mobile filtering and receipt wrapping resolved. The implementation preserves the preexisting modified `barracks-pwa/AGENTS.md`, which is deliberately excluded from task commits. Evidence/savepoint documentation is committed separately. This remains a partial acceptance delivery; the pending plan criteria are not marked complete.

## Compatible environment closes pending booking criteria

After the user selected a disposable compatible database, a loopback-only PostgreSQL17 cluster was initialized on55432 and a separate built app started on3001. Existing migrations/seed succeeded (7unique shop weekdays,21migrations). Live creation, mobile edit, check-in, explicit start, completion and confirmed cancellation passed. Overlapping cancelled/confirmed historical blocks, long synthetic name, unknown duration and an empty barber day were inspected with guarded local fixtures. Unassigned bookings are not supported by the current assigned-barber model. See local-demo.md for local configuration, commands and exact screenshots. The original instance's409 is unchanged; it no longer blocks completion in the selected environment.

Phase acceptance is complete with the bounded manual/source evidence described here. Earlier pending statements above describe the original instance and investigation stage; this final compatible-environment result supersedes them. No automated tests or production migration were performed. Physical print output and exhaustive permutations remain review limits, not represented as exercised checks.

## Final completion audit

The phase's seven layouts, shared navigation/filters/freshness, documentation, role controls, live desktop/mobile representative workflows, data constraints and local savepoints were checked against the original attached brief and plan. The final local outage/recovery walkthrough covers the changed module error states (see local-demo.md), including the subsequently fixed Front Desk metric dashes. The final build passed after that fix; the reviewer scored the additional fix resolved. Design inheritance documentation is complete. Database restored; app3001 remains available for review. Original production/demo schema and branch boundaries are preserved. No required blocker remains in the user-selected compatible environment; bounded review limits above are disclosed rather than represented as exercised checks.

Final implementation commits: a0a59b0 (layouts/read-only projections) and6f50bf6 (honest unavailable metrics). Evidence and completed plan are saved in the delivery documentation commit.
