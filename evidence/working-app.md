# Working Supabase demo — October 10, 2026

Target: `barracksbarbers` (`gngepbytysjztnrsbotn`), migration 028. Application: https://barracksbarbers.vercel.app.

The user authorized a complete working app with seeded data after payroll migration. The additive `scripts/seed-working-app.ts` command uses the existing database connection, all five known demo branches, verified demo Manager/Front Desk identities and explicit memberships. It never replaces users or passwords, rewrites existing financial/stock/attendance/payroll records, disables constraints, or assigns percentages to unmarked historical services.

## Data and preservation

- Added eight demo barbers (two per satellite branch), with branch-specific schedules. Main retains its existing roster.
- Added 40 accountless profiles with visible demo names and stable phone identifiers.
- Added 540 historical/current-day completed walk-ins with matching successful tenders and source timestamps, plus current queues, today’s completed/cancelled appointments, and a week of future reservations. Future appointments check the branch’s hours, shifts, breaks, reservations, and time away.
- Expanded satellite stock from the two original restock showcase items to the full 26-item original catalog, including equipment. Existing stock quantities and receiving history are preserved.
- Expanded attendance to all demo branch rosters, preserving recorded daily attendance and corrections.
- Configured missing branch calendars with September 5, 2026 as the explicit demo anchor. Added 30 demo payroll records: 15 Paid, 5 Draft, 5 Pending Approval, and 5 Approved, plus current earnings. The paid records have `DEMO-ONLY-NO-FUNDS` references; generating audit events and historical fixture-rate corrections carry **DEMO ONLY** explanations. No funds were transferred.
- Historical percentages were confirmed only for documented original demo bookings and new marked demo queue fixtures. One existing unmarked historical service remains unresolved.
- Fingerprints of existing users, profiles, suppliers/links, sales, tenders, financial actions, attendance/corrections, inventory/movements, restocks/lines, payroll records/payments/corrections, and separately existing calendars matched before commit.
- Repeating the unchanged seed committed with zero new corrections and preserved all existing records. A first attempt failed on a PL/pgSQL conflict-target ambiguity and rolled back completely; using untargeted `ON CONFLICT DO NOTHING` resolved it without changing schema constraints.
- Live checks found zero tender/header mismatches and zero transaction/visit branch mismatches.
- Final totals: 12 accounts, 17 barbers, 59 customer profiles, 130 inventory rows (26 per branch), 291 bookings, 684 sales with 684 matching tenders, 260 attendance records, and 30 payroll records. New appointment fixtures totaled 118; existing reservations caused two candidate slots to be skipped.

## Rendered hosted-app evidence

Authenticated as the existing demo Manager on the deployed app. Main Branch payroll rendered current earnings, three paid records, one draft, one pending approval, one approved record, and the untouched unresolved historical service.

Selected Bajada through the rendered branch selector. Its overview showed three current earners, three paid records, one pending approval, and one each draft/approved. The paid Demo Bajada record #7 rendered 14 eligible services, PHP 2,180 gross/payable/paid, the September 5–18 period, Manager approval/time, a `DEMO-ONLY-NO-FUNDS-BAJADA-2026-09-05-6` reference, per-service source receipts, original prices, 40% rates, and an audit trail. Print/Save PDF and Download payslip controls were available. No hosted payment or approval button was clicked during verification.

The hosted Bajada dashboard also rendered PHP 8,050 paid/net sales and 21 paid visits across seven days, dated sales detail, low/out-of-stock links, two today's non-cancelled bookings, 21 upcoming confirmations, three active roster members, and two open restocks. Read-only Vercel project-detail inspection returned a scope permission error and no CLI was installed; direct authenticated hosted-app verification succeeded independently.

## Source checks and scope

TypeScript (`npx tsc --noEmit`) and scoped ESLint (`npx eslint scripts/seed-working-app.ts`) passed. No additional test runner was invoked for this seed request; the prior migration request’s 21-test suite remains documented in `PAYROLL_IMPLEMENTATION.md`. The deployed app consumes Supabase immediately; these scripts and documentation are saved locally without a Git push or merge. The pre-existing `barracks-pwa/AGENTS.md` edit is preserved.
