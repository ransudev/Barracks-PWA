# Tasks

Status: Local P0 stages 0–5 completed; P1 and hosted release work remain pending. Execute only the authorized phase. Each completed task must link to an evidence entry. `[ ]` means pending or blocked, not failed product behavior.

## Stage 0 - Baseline

- [x] T001 Record branch/commit, pre-existing changes, environment identities, and applicable instructions. Exclude secrets from evidence. Evidence: [E01–E06](evidence.md).
- [x] T002 Reproduce P0 findings and classify product, harness, advisor, and missing-evidence cases. Evidence: [E01–E06](evidence.md).
- [x] T003 Inventory exposed database objects/privileges, backend role requirements, and clients dependent on current access. Evidence: [E01–E06](evidence.md).
- [x] T004 Establish a disposable DB and role/branch fixtures; prove its target is separate from production. Evidence: [E01–E06](evidence.md).
- [x] T005 Resolve D01/D02 or record them as pending before their dependent implementation; prepare work independent of those decisions. Evidence: [E01–E06](evidence.md).

## Stage 1 - Database security; depends on T001-T004

- [x] T006 Design preservation-safe grants/RLS/exposure/default-privilege migration covering tables, sequences, views, functions, and payroll objects. (FR-001/002) Evidence: [E01–E06](evidence.md).
- [x] T007 Implement and validate the new migration in the isolated database from fresh and existing-baseline schemas. Evidence: [E01–E06](evidence.md).
- [x] T008 Prove API-role denial and backend success, including function-mediated access and newly created objects. (SC-001) Evidence: [E01–E06](evidence.md).
- [x] T009 Prepare named-target rollout, preservation queries, HTTP denial checks, and a secure recovery/forward-fix procedure. Hosted application remains separately authorized. Evidence: [E01–E06](evidence.md).

## Stage 2 - Dependencies; depends on T001/T002

- [x] T010 Verify advisories and exposure; select patched supported runtime/development dependencies. (FR-004) Evidence: [E01–E06](evidence.md).
- [x] T011 Update dependency/lockfile versions and resolve resulting compatibility issues. Evidence: [E01–E06](evidence.md).
- [x] T012 Verify fresh install, default build and any supported alternate, type checks, lint, and security disposition. Record residual advisories. (SC-006) Evidence: [E01–E06](evidence.md).

## Stage 3 - Staff authorization; depends on D01 and T004

- [x] T013 Implement shared actor/target branch authorization across all staff API actions. (FR-003) Evidence: [E01–E06](evidence.md).
- [x] T014 Make Manager staff creation and explicit branch assignment atomic; revalidate membership during sensitive mutations. Evidence: [E01–E06](evidence.md).
- [x] T015 Cover shared/unassigned targets, foreign IDs, membership revocation, and Administrator/last-admin behavior. (SC-002) Evidence: [E01–E06](evidence.md).
- [x] T016 Align staff UI with server scope and verify authorized versus denied browser actions. Evidence: [E01–E06](evidence.md).

## Stage 4 - Eligibility; depends on D02 and T004

- [x] T017 Implement shared attendance/current-state/interval eligibility and stable reasons. (FR-005/006/008) Evidence: [E01–E06](evidence.md).
- [x] T018 Apply it transactionally to manual/suggested walk-in and appointment starts with immutable duration, own-booking exclusion, and consistent locks. (FR-007) Evidence: [E01–E06](evidence.md).
- [x] T019 Integrate attendance actions, availability counts, failure explanations, and refresh behavior. Evidence: [E01–E06](evidence.md).
- [x] T020 Verify missing/absent/clocked-out attendance, breaks/shifts, collisions, exact boundaries, future dates, catalog-independent duration snapshots, and concurrent starts. (SC-003) Evidence: [E01–E06](evidence.md).

## Stage 5 - Local P0 acceptance; depends on T007-T008/T011/T013-T020

- [x] T021 Repair meaningful existing regression failures and lint issues without weakening intended coverage. Evidence: [E01–E06](evidence.md).
- [x] T022 Run focused disposable-DB booking, queue, payment, refund, payroll, and restock regressions; critical cases must execute. (SC-004/005/006) Evidence: [E01–E06](evidence.md).
- [x] T023 Run authenticated browser checks for changed P0 workflows and branch switching; record viewport and role/branch evidence. Evidence: [E01–E06](evidence.md).
- [x] T024 Update the root README for implementation changes, complete local P0 checklist entries, and report the reviewable rollout package and pending hosted gates. Evidence: [E01–E06](evidence.md).

## Stage 6 - P1 workflows; separately authorized

- [ ] T025 Preserve staff-visible historical booking reads after customer deactivation; prove login remains denied. (FR-009)
- [ ] T026 Resolve D03; align catalog/advertised prices and valid service/branch context through login. (FR-010/016)
- [ ] T027 Resolve D05; design additive discount contracts and legacy compatibility. (FR-011/012)
- [ ] T028 Implement authorized discount checkout, receipts/reports, net-paid refunds, and unchanged original-price commission. Verify retry/race/rounding/zero-net policy cases. (SC-004)
- [ ] T029 Resolve D04; implement supported recovery, abuse controls, audit handling, secure credential delivery, and session invalidation. (FR-013)
- [ ] T030 Verify database TLS trust and add bounded readiness/error behavior. (FR-014/015)
- [ ] T031 Resolve D06; document deployment, backup ownership, selected RPO/RTO, and isolated restore procedure.
- [ ] T032 If separately authorized by an assigned Manager, resolve historical unknown rates using audit evidence; otherwise retain the pending exception without guessed rates.
- [ ] T033 Update README and verify the selected P1 workflow/browser acceptance. (FR-017/018)

## Stage 7 - Release evidence; depends on required P0/P1 work

- [ ] T034 Verify clean setup/migration/build/start and complete staging workflows across all required roles and representative viewport sizes. (SC-007)
- [ ] T035 Prepare the exact release, named target, data-preservation evidence, migration set, rollout checks, and recovery instructions for final authorization.
- [ ] T036 Following explicit authorization, apply named hosted actions and prove Data API denial/backend success on the resulting environment. (SC-001/008)
- [ ] T037 Verify exact deployed commit/migration identity, TLS and readiness behavior, and operational reconciliation.
- [ ] T038 Restore a recorded backup into an isolated target and demonstrate chosen recovery targets and invariants. (SC-008)
- [ ] T039 Complete the release checklist and readiness verdict; leave every unmet criterion explicitly pending or blocked.

## Stage 8 - Optional follow-up

- [ ] T040 Select and separately scope P2 settings/reminders/pagination/installability/accessibility work before implementation.

The ordering describes dependencies, not permission to delegate, install infrastructure, or execute hosted changes. Stages 1/2 can progress independently where inputs are available; acceptance and mutations follow their stated dependencies.
