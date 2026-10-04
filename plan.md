# Phase: Task-focused operational screens

Status: Complete on `layout-redesign`; compatible isolated demo verification recorded in evidence/layout-redesign/local-demo.md.

## Goal

Improve how staff and management find appointments, check out completed visits, understand business activity, review attendance, and receive stock. Use layouts suited to those tasks while retaining a shared visual language and existing business rules.

This plan is the scope for the next implementation phase. It supersedes `IMPLEMENTATION_PLAN.md` only for the screens and shared changes listed here; that earlier document remains historical context. Creating this plan does not begin implementation.

## Start with /goal

Use this prompt when ready:

> Implement the task-focused operational screen phase in the repository-root plan.md. Complete stages 0–6 in order, preserve existing business rules and role permissions, verify the changed screens in the browser, and update the plan checklist with evidence as each stage finishes. Follow barracks-pwa/AGENTS.md. Keep changes local; do not push, merge, deploy, or apply production database migrations. Report any blocked acceptance criteria instead of marking them complete.

## Scope and boundaries

- Primary screens: Bookings, barber schedules, Front Desk Payments, Management Transactions, Management Dashboard, Attendance, and Restocks.
- Shared work: consistent filter toolbars, accurate loading/error/empty states, freshness indicators where relevant, and module-aware navigation.
- Front Desk Dashboard: targeted emphasis on today's queue and upcoming appointments, with freshness behavior. A complete dashboard redesign is deferred.
- Keep existing role distinctions, API contracts, server validation, and explicit confirmations. Queue assignment and service start remain staff/front-desk actions with explicit controls and server authority.
- Preserve booking availability rules, shop hours, breaks, time away, branch boundaries, Manila date handling, attendance correction history, payment eligibility, refund/void permissions, and restock transitions.
- Reuse existing components and visual tokens. Retain the current typography baseline. Visual consistency comes from controls and behavior rather than identical page composition.
- Add read-only data aggregation only where needed to support an accepted view. Preserve existing response contracts; document additive fields/endpoints. A schema change or new business workflow requires a separately defined scope before implementation.
- Queue lanes, Barber Floor restructuring, full roster redesigns, customer/supplier dashboards, Services, Reports redesign, commission recalculation, and public landing changes are deferred.
- Preserve unrelated local changes, including the pre-existing modification to `barracks-pwa/AGENTS.md` observed while creating this plan.

## Stage 0 — Confirm source, data, and visual baseline

- [x] Read applicable instructions and relevant local Next.js documentation before code changes. Inspect Git status and use an appropriate dedicated implementation branch.
- [x] Inspect the current screens, shared operational components, navigation, and relevant API/service paths.
- [x] Capture the existing screens at desktop and mobile widths using the current local app and authorized account access.
- [x] Record which data is available for calendar duration/availability, attendance schedules, financial summaries, and restock actions. Separate missing data from missing UI.
- [x] Identify the representative first screen: Bookings day view. Implement and inspect that direction before spreading new layout patterns.

Done when: the implementation has a documented data map and visual baseline, with concrete limitations recorded. Source inspection alone does not verify visual quality.

## Stage 1 — Shared usability and navigation

- [x] Use consistent search, filters, result counts, and reset behavior in the screens changed by this phase. Remove redundant titles/counts where they add no useful context.
- [x] Show loading placeholders or unavailable values instead of apparent zeroes. Distinguish errors, no results, and genuinely empty data.
- [x] Make breadcrumbs reflect the active module. Group sidebar destinations into Business, People, and Stock while preserving role access and existing destinations.
- [x] Show refresh controls and last-successful-update information on relevant operational summaries. Refresh failures must remain visible; timestamps must reflect real successful data loads.
- [x] Give today's queue and upcoming appointments priority in the Front Desk Dashboard; reduce competing summaries without changing queue behavior.

Done when: users can identify their current module, filter records consistently, and tell whether operational information is loading, current, empty, or unavailable.

## Stage 2 — Bookings and schedules

- [x] Build a desktop day schedule with barber columns and time blocks. Show customer, service, time, and status without opening every appointment.
- [x] Derive block lengths from authoritative service/booking duration. Show shifts, breaks, and time away where supported. A visible gap is not proof of bookable availability; use the existing availability rules.
- [x] Keep date navigation, status filtering, and search. Retain an agenda/list view for mobile and dense record review.
- [x] Reuse the booking detail drawer and existing create/edit/check-in/completion/cancellation actions with their current role and state restrictions.
- [x] Replace the long weekly schedule form's main presentation with a weekly shift timeline; select a day to edit using existing validated controls. Place shop-hours editing in a distinct tab/section.
- [x] Handle overlapping blocks, long names, many barbers, empty days, and unassigned bookings if supported by the current model.

Done when: a user can locate an appointment by barber and time, inspect scheduling constraints, and perform existing authorized actions on desktop and mobile. A full multi-barber week booking calendar and drag-to-reschedule are deferred.

## Stage 3 — Payments and transactions

- [x] Replace the Front Desk visit dropdown as the main selection interface with a searchable list of eligible completed unpaid visits beside focused checkout on desktop.
- [x] Make customer, service, visit identity, amount due, payment method, amount received, and change clear for the selected visit. Stack selection and checkout logically on mobile.
- [x] Preserve processing feedback, payment confirmation, receipts, and server rejection of duplicate or no-longer-eligible checkout. Refresh eligibility after successful payment.
- [x] Present Management Transactions as a compact ledger with existing useful filters and pagination.
- [x] Place receipt, transaction detail, audit history, and permitted refund/void actions in a detail drawer. Preserve confirmations and action visibility rules.

Done when: staff can find the correct payable visit and finish checkout, and management can locate a transaction and inspect its history without losing ledger context. Payment amounts and financial action rules remain authoritative on the server.

## Stage 4 — Management Dashboard

- [x] Rebalance the hierarchy around business activity and actionable exceptions. Move inventory value out of its current dominant position.
- [x] Define each primary metric's period, branch scope, and meaning before implementation. Use at most four primary metrics supported by reliable data.
- [x] Add a compact sales trend only when an authoritative aggregation is available. Distinguish paid sales, refunds/voids, and date boundaries according to existing financial semantics; avoid presenting estimated profit.
- [x] Consolidate actionable stock/restock exceptions into a Needs attention area with links to the relevant records.
- [x] Keep bookings and staffing visible as supporting context. Label active roster counts accurately rather than treating them as on-duty counts.
- [x] Provide honest loading, error, empty, and freshness states for the overview and chart. If required data cannot be supplied within scope, document the limitation and keep the affected criterion pending.

Done when: management can understand the defined business period, spot actionable exceptions, and reach the relevant module. Every displayed number and chart has a documented source and meaning.

## Stage 5 — Attendance

- [x] Add a monthly matrix with barbers as rows and dates as columns for reviewing patterns.
- [x] Select a cell to inspect status, clock times, and correction history; retain the existing correction controls and permissions.
- [x] Keep a daily/list view for detailed review and mobile use. Provide month/date navigation and existing relevant filters.
- [x] Distinguish recorded Absent from Unmarked and future dates. Show scheduled days off/time away only when authoritative schedule data supports that conclusion; missing attendance alone does not imply absence.
- [x] Use visible status labels or symbols with a legend, rather than color alone. Keep cell controls keyboard-accessible and names/dates understandable during scrolling.

Done when: users can identify monthly patterns and inspect/correct an individual record without introducing inferred absences or losing the daily workflow.

## Stage 6 — Restocks

- [x] Map existing backend statuses and role-specific actions before choosing visual grouping. Display labels must not create new workflow states.
- [x] Prototype grouped active requests. Use a board when it improves scanning at realistic volume; use a grouped list if that is clearer, and record the choice with visual evidence.
- [x] Show supplier, branch, item summary, current stage, and the next authorized action on each active request.
- [x] Keep completed/cancelled/rejected history separately searchable with existing detail access.
- [x] Preserve request details, preparation/shipping/delivery controls, receiving confirmation, and stock update behavior according to existing transitions.
- [x] Use explicit buttons for transitions. Adapt groups to mobile without requiring a wide board to complete routine actions.

Done when: users can see which requests need their action and complete existing authorized transitions, including receiving stock, while history remains easy to find.

## Verification and delivery

- [x] Update the relevant `README.md` sections alongside implementation, as required by repository instructions.
- [x] Perform proportionate non-test checks for changed code using the current project configuration. Automated tests require a separate explicit request under the repository policy; this plan calls for manual browser verification.
- [x] Verify each changed screen at desktop and mobile widths with realistic data. Check keyboard operation, visible focus, readable labels, drawers, empty/error/loading states, and long or dense content.
- [x] Verify management and front-desk role behavior. Use controlled local/demo records for mutation walkthroughs and avoid production actions.
- [x] Record browser evidence for appointment lookup, schedule editing, eligible-visit checkout, transaction inspection, management exceptions, attendance correction, and restock receiving.
- [x] Review the final diff and create meaningful local savepoint commits in line with applicable repository instructions. Keep push, merge, deployment, and production migration outside this goal.
- [x] Record any access/data/environment blocker precisely. A blocked criterion remains unchecked; do not substitute build success for a browser walkthrough.

The phase is complete when all required criteria are satisfied, the changed workflows remain usable and authorized, documentation is current, and the final report links to the evidence and identifies the implementation branch and commits.

## Progress and evidence log

Update this table as work completes. Include actual evidence paths or commands and outcomes, not planned checks.

| Stage | Status | Evidence / decisions / blockers |
| --- | --- | --- |
| 0 — Baseline | Complete | Source/data map and desktop/mobile baseline PNGs in evidence/layout-redesign. |
| 1 — Shared usability | Implemented / walked through | Module breadcrumbs and grouped role navigation; shared filters and successful-load freshness; frontdesk-desktop/mobile.png. |
| 2 — Bookings and schedules | Implemented / walked through | bookings-final-desktop/mobile.png; schedule-edit-mobile.png and restored schedules-mobile.png. Original demo409 retained; compatible isolated demo on3001 verifies create/edit/check-in/start/complete/cancel, historical overlap/long name, unknown duration and empty day. Unassigned is unsupported by current model. See local-demo.md. |
| 3 — Payments and transactions | Implemented / walked through | Demo walk-in#7 paid PHP300 cash500/change200; persisted receipt and refreshed eligibility. checkout-mobile.png; transaction-detail-desktop/mobile.png. Duplicate rejection retained server-side; no manufactured duplicate mutation. |
| 4 — Management Dashboard | Implemented / walked through | management-desktop/mobile.png; source/period semantics documented; exact item/request links verified in management-stock-link-desktop.png and management-request-link-desktop.png. |
| 5 — Attendance | Implemented / walked through | Monthly matrix and daily list; MikoOct1 corrected then restored with both history entries. attendance-correction-desktop.png / attendance-restored-mobile.png; absent-filter matching4Luis records. |
| 6 — Restocks | Implemented / walked through | Grouped active list, searchable true-status history; demo request35Received18 bottles, inventory24. restock-received-detail-mobile.png / restock-inventory-mobile.png. |
| Verification and delivery | Complete / limits recorded | TypeScript, targeted ESLint, production build and diff whitespace checks passed. Fresh reviewer scored all listed material fixes resolved; implementation savepoint a0a59b0 and unavailable-metric fix6f50bf6; see implementation.md/local-demo.md for completed edge/error walkthroughs and bounded print/permutation limits. |

All phase criteria are checked with proportionate source/manual evidence. Review limits remain explicit: no automated tests, arbitrary network-failure injection, exhaustive role/state permutations, or physical receipt print validation. Existing behavior is preserved; no production schema/migration, push, merge or deployment was performed. The isolated disposable database uses only existing migrations.
