# Barracks production-readiness spec kit

Created: 2026-10-11, Asia/Manila. Status: Local P0 stages 0–5 complete on `codex/production-readiness`; production release remains NOT READY.

This Spec Kit-style document bundle turns the system audit and improvement discussion into an execution contract. It does not install the Spec Kit CLI, configure slash commands, or authorize changes to a deployed environment.

## Read and execute

1. Read [spec.md](spec.md) for requirements, business rules, and decisions.
2. Read [plan.md](plan.md) for phases, implementation boundaries, and completion gates.
3. Follow [tasks.md](tasks.md) in dependency order during an authorized implementation.
4. Use [checklist.md](checklist.md) for acceptance; record proof in [evidence.md](evidence.md).

The existing repository-root `plan.md` describes an earlier operational-screen phase and remains intact. `payrollspec.md` remains authoritative for established payroll rules. `auditspec.md` defines the original audit, not permission to implement these changes.

## Start local P0 work with /goal

Copy this prompt when ready to authorize implementation:

> Implement the local P0 scope in specs/001-production-readiness/plan.md, following specs/001-production-readiness/spec.md and tasks.md. Complete stages 0-5, run their focused acceptance checks against a disposable local database, and record evidence. Preserve payroll rules, existing UI structure, and unrelated working-tree changes. Follow barracks-pwa/AGENTS.md. Keep changes local: do not push, merge, deploy, or change hosted databases/infrastructure. Prepare the production security migration and rollout instructions for review, but leave live acceptance unchecked. Finish with the locally completed tasks, failed or blocked criteria, and concrete release blockers.

For P1, authorize stage 6 separately after its relevant decision records are resolved. Production rollout requires explicit authorization for the named environment and action.

## Completion meanings

- **Spec kit complete:** Documents are written and linked; this does not mean any product fix passed.
- **Local P0 complete:** Stages 0-5 have passing local evidence and a reviewable rollout package. Hosted security remains pending until verified live.
- **Production ready:** Every required P0/P1 release criterion has evidence for the exact release/environment, including hosted database denial, operational browser workflows, deployment, and restore validation. Deferred optional features have an explicit scope statement.

Local P0 evidence and checked tasks are recorded in [evidence.md](evidence.md). P1 and hosted release gates remain unchecked. Prior audit results remain dated baseline observations.
