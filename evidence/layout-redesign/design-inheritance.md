# Design inheritance — operational layout extension

Confirmed 2026-10-04 against the scoped brief in `../../plan.md`, implementation evidence, incumbent styles, changed source, and saved browser captures. This phase extends operational layouts within the existing Barracks identity. It does not establish a new visual world or create a normative `PRODUCT.md`, `DESIGN.md`, or `.impeccable/design.json`.

## Confirmed inheritance

- `barracks-pwa/app/layout.tsx` retains Inter as `--font-dashboard-sans` and Sora as `--font-dashboard-accent`. The existing assignments in `globals.css` and later overrides in `theme.css` remain the authority; an earlier root serif rule is not the effective dashboard identity.
- The incumbent monochrome shell, off-white text, red actions, semantic status colors, borders, rounded controls, panels, logo, icon vocabulary, and detail drawers remain recognizable in the baseline/final comparisons. `globals.css` and `theme.css` have no working-tree diff at this inspection. Their existing theme-specific overrides remain authoritative rather than being copied into a second token registry.
- `app/operational-layouts.css`, imported after both incumbent stylesheets, consumes their variables for task-specific composition. Its local sizes and breakpoints describe these screens, not a new global spacing, radius, typography, or motion system. Existing layered surfaces and drawer behavior are inherited even where a generic craft-floor preference differs.

## Documented pattern changes

| Surface | Scoped extension |
| --- | --- |
| Shared shell and controls | AppShell groups authorized destinations into Business, People, and Stock and names the active module in breadcrumbs. Existing FilterToolbar gains reset behavior; FreshnessBar shows successful-load time in Manila, refresh, and failure feedback. |
| Bookings | DaySchedule replaces metric/card emphasis with a time axis and barber columns; authoritative durations, interval lanes, constraints, and explicit unknown-duration handling support lookup. Scale is four pixels per minute so an ordinary 30-minute block exposes its facts. Mobile uses an agenda. Gaps are explicitly not offered as bookable slots. |
| Barber schedules | A weekly shift timeline selects the existing day editor; shop hours stay in a separate tab. Mobile moves the track beneath the day/time facts. |
| Payments and transactions | Desktop pairs searchable eligible visits with checkout; mobile stacks them. History is a ledger, with receipt, audit, and permitted financial actions in the existing drawer. Receipt references wrap within their value column. |
| Dashboards | Front desk prioritizes queue and upcoming appointments. Management uses four defined seven-day sales metrics, daily sales/reversal detail, and linked exceptions; inventory value becomes supporting context. Active roster is not labeled on duty. |
| Attendance | Desktop adds a month matrix with sticky names/dates and a textual legend. Mobile keeps record review; monthly status filtering selects matching barbers while preserving their complete monthly records through the same visibleBarbers set. Missing attendance is not inferred absence. |
| Restocks | Grouped active requests expose supplier, branch, item facts, actual status, and explicit next action; history is separate. Groups are presentations of existing backend states, not new transitions. Mobile stacks each request and its action. |

Read-only support is additive: `app/api/scheduling/day/route.ts` supplies staff schedule context without granting editing or bookable availability. `app/api/dashboard/management/route.ts` reuses the revenue report and adds sales, error, scope, generation time, and actionable-restock fields. These sources were inspected alongside the named pages, AppShell, OperationalPrimitives, DaySchedule, and the README phase documentation.

## Evidence and limits

Visually compared baseline Bookings, Dashboard, Attendance, and Restocks desktop captures with `bookings-final-desktop/mobile.png`, `management-desktop/mobile.png`, `attendance-desktop.png`, `attendance-restored-mobile.png`, `restocks-desktop/mobile.png`, `transaction-detail-desktop/mobile.png`, and `schedules-mobile.png`. The same shell, fonts, controls, and palette persist while each task gains its own composition. Final Bookings evidence supersedes the earlier direction captures.

This is an inheritance report, not comprehensive accessibility or behavior certification. The inspected captures show dark mode and particular viewport/scroll positions; light mode, all responsive positions, contrast measurements, every keyboard/state permutation, and actual receipt print output were not independently verified here. Shop-hours ambiguity and unavailable live booking edge fixtures remain the limitations recorded in `implementation.md` and the unchecked plan criteria. No app changes, automated tests, broad drift repair, or memory writes were performed in this documentation pass.

## Addendum — compatible local demo and failure evidence

The later user-selected disposable demo closes the earlier booking workflow/fixture evidence gap without changing the original database or API/schema/business rules; see `local-demo.md` for the completed create, edit, check-in, service-start, completion, cancellation, and empty-day walkthroughs. The original instance's duplicate-weekday 409 remains an instance-specific limit. Unassigned bookings are unsupported by the current model rather than an unverified required case.

Inspected `isolated-booking-overlap-desktop.png`: overlapping confirmed/cancelled historical appointments occupy separate lanes, a long synthetic customer name remains readable, and an unknown-duration appointment is listed separately without invented geometry. Inspected `isolated-frontdesk-error.png` and StaffDashboard source: today's bookings and active roster now show a dash on load failure as well as loading; refresh failure and unavailable queue/booking content use the existing semantic vocabulary. These additional states preserve the Sora/Inter identity, inherited palette, controls, and shell; no token or identity change accompanies them.

The additional evidence supersedes only the earlier booking environment/fixture limitations. Dark-mode/viewport coverage, unmeasured contrast, exhaustive keyboard/state permutations, and actual print-output limits above remain at their original inspection scope. This addendum changes documentation only.
