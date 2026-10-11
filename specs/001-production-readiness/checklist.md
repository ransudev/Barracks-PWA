# Acceptance and release checklist

Local P0 criteria passed (E01–E06); P1 and hosted release criteria remain pending. Add an evidence ID beside each checked item. A skipped test, proposed migration, source inspection, or local-only success cannot satisfy a required hosted/runtime gate.

## Scope and decisions

- [x] Current branch/commit, target environment, and existing changes are recorded. Evidence: [E01–E06](evidence.md).
- [x] Required D01-D06 decisions are resolved for the selected phase. Evidence: [E01–E06](evidence.md).
- [ ] Required versus optional launch workflows are explicitly identified for the final release (P1/D03–D06 pending).
- [x] Existing payroll, refund/void, branch, and Manila-date rules remain intact. Evidence: [E01–E06](evidence.md).

## P0 local acceptance

- [x] All exposed internal object types and future default privileges were inventoried. Evidence: [E01–E06](evidence.md).
- [x] Isolated API roles cannot read/write protected objects or bypass them through functions/views. Evidence: [E01–E06](evidence.md).
- [x] Backend authorized workflows still work after the security migration. Evidence: [E01–E06](evidence.md).
- [x] Fresh and existing-baseline migrations preserve users, memberships, visits, transactions, tenders, stock, and payroll history. Evidence: [E01–E06](evidence.md).
- [x] All staff endpoints enforce D01, including shared/unassigned targets and membership changes. Evidence: [E01–E06](evidence.md).
- [x] Attendance, UI availability, and manual/suggested starts agree under D02. Evidence: [E01–E06](evidence.md).
- [x] Full-duration checks protect appointments, breaks, shifts, and exact boundaries using visit snapshots. Evidence: [E01–E06](evidence.md).
- [x] Concurrent starts/bookings do not produce duplicate active service or overlap. Evidence: [E01–E06](evidence.md).
- [x] Applicable critical/high runtime dependency advisories are remediated; other advisories have a recorded disposition. Evidence: [E01–E06](evidence.md).
- [x] Required regression cases execute successfully; lint, type checking, supported install/build/start pass. Evidence: [E01–E06](evidence.md).
- [x] Payment retries, tender identity, refunds, payroll snapshots/approval, and restock receipt/inventory regressions pass. Evidence: [E01–E06](evidence.md).
- [x] Authenticated browser checks cover changed P0 behavior and branch switching. Evidence: [E01–E06](evidence.md).
- [x] README and rollout instructions match the implementation; external acceptance remains explicit. Evidence: [E01–E06](evidence.md).

## Required P1 acceptance

- [ ] Deactivation prevents login while preserving branch-authorized historical views.
- [ ] Public bookable prices/offerings match the authoritative catalog and D03.
- [ ] Valid branch/service context survives login and is revalidated; invalid/retired selections prompt correction.
- [ ] Discounts follow D05, reconcile original/discount/net receipt and report amounts, and preserve commission/refund rules.
- [ ] Customer recovery follows D04 and excludes secrets from logs/evidence.
- [ ] TLS verifies the PostgreSQL server identity.
- [ ] Readiness detects unavailable PostgreSQL within a bounded deadline and discloses no sensitive details.
- [ ] Required desktop/tablet/mobile, keyboard, focus, label, loading/error/conflict, and stale-branch checks pass.
- [ ] Historical unknown payroll rates are resolved by evidence or remain documented exceptions without fabricated earnings.

## Hosted release gates

- [ ] Named hosted actions were explicitly authorized before execution.
- [ ] Exact release commit, migration names, environment, and verification time are recorded.
- [ ] Anonymous and Supabase-authenticated Data API denial is verified on the actual release environment without exposing row data.
- [ ] Authorized backend workflows still pass on that environment.
- [ ] Complete booking, walk-in, attendance, payment/refund, payroll, restock, reporting, and branch-switch workflows have authenticated staging acceptance.
- [ ] A clean supported deployment succeeds; default build behavior is covered.
- [ ] An isolated backup restore meets D06 and reconciles retained financial, inventory, branch, and payroll invariants.
- [ ] Remaining P2 work is excluded through explicit release scope; no required criterion is disguised as optional.

## Verdict

Record exactly one release verdict with evidence:

- READY: All applicable required release gates passed.
- CONDITIONALLY READY: Only minor issues remain under explicit, evidence-supported operating restrictions; no unresolved security/data-integrity blocker.
- NOT READY: A required security, essential workflow, financial integrity, or verification gate remains unmet.

Local P0 completion has its own milestone and must not be reported as READY while hosted security or required operational acceptance is pending.

Selected release verdict: **NOT READY**. Local P0 is complete. Required P1, live API denial/backend verification, complete authenticated staging acceptance, deployment identity and isolated restore proof remain pending. No hosted changes, push or merge were performed.
