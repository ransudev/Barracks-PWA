# Implementation plan

Status: Local P0 stages 0–5 authorized by the user and implemented; stages 6–8 remain pending separate scope/authorization.

## Execution boundaries

Read [spec.md](spec.md) and applicable `AGENTS.md` before implementing. Run Git at the repository root and application commands inside `barracks-pwa`. Reinspect the current branch, working tree, installed versions, migration numbering, deployed grants, and client integrations; the audit is a dated baseline.

Keep existing application architecture, operational screens, payroll rules, historical snapshots, and unrelated local changes. This kit scopes a new readiness phase; the older root `plan.md` is historical scope and is not being edited or re-executed.

An implementation request may authorize local code, local migrations, and the focused tests explicitly required here. Hosted migrations/data changes, permission/exposure changes, deployment, push, and merge require authorization for the named target/action. Prepare concrete migrations and verification instructions before requesting that final action. Never run integration tests or destructive demo seeds against production.

## Stage 0 - Establish a reproducible baseline (P0)

Record current source/environment identity, applicable rules, affected contracts, exposed database objects, and prerequisite decisions D01/D02. Prepare an isolated database and representative role/branch fixtures. Reproduce each relevant P0 finding safely; classify harness failures separately from product failures.

Complete when the baseline, affected clients, policy decisions, and safe verification targets are recorded in [evidence.md](evidence.md). A missing hosted access check is marked blocked, not guessed.

## Stage 1 - Contain database exposure (P0, Medium)

Inspect `server/db/migrations`, the migration runner, database role permissions, and any direct Supabase clients. Design a new migration for internal table/sequence/view/function grants, RLS/exposed schema policy, and future default privileges. Preserve payroll restrictions and authorized backend access; account for function privileges rather than assuming table revocation covers them.

Validate locally with real `anon`/`authenticated` roles and the backend role. A SQL test database may not provide PostgREST; HTTP Data API denial then requires separately authorized staging/live evidence. Prepare preservation queries and rollout/forward-fix instructions. Recovery must not reopen insecure grants as an automatic rollback.

Complete locally when protection and authorized workflows pass, migrations work from both an empty database and the existing schema baseline, and hosted verification is a reviewable pending step. Production containment is complete only after the exact live target denies access.

## Stage 2 - Remediate dependencies (P0, Medium)

Verify current advisories against the installed graph and actual enabled features. Select patched supported versions, update the lockfile without unrelated package churn, and repair compatibility changes. Read the installed Next.js guidance before implementation.

Complete when the supported install/build/type/lint path works and dependency evidence has no unresolved exploitable critical/high runtime finding. Record development-only advisories separately with their disposition. Check the default production build as well as any intentionally supported alternate builder; a webpack-only success does not prove the default path.

## Stage 3 - Enforce staff branch authority (P0, Medium)

Resolve D01. Extend shared server authorization and transactions in `app/api/users`, `server/services/user.service.ts`, and existing branch helpers. Cover list/detail/create/update/lifecycle/delete, atomic membership creation, shared/unassigned targets, and concurrent membership changes. Preserve existing role and last-administrator rules.

Complete when SC-002 passes and authenticated UI only offers actions the server authorizes. Changing a branch/target identifier cannot expand access.

## Stage 4 - Unify service eligibility (P0, Medium)

Resolve D02. Extend `barber-operational-availability.service.ts`, `booking-availability.service.ts`, queue/booking transitions, attendance actions, and related UI/API contracts. Factor shared interval semantics without redesigning queue selection. Use a transaction-capable database interface, consistent locks, authoritative clock, immutable duration, and own-booking exclusion.

Return stable reasons for absence, clock-out, active service, off-shift, break, time away, reservation collision, and invalid branch. Keep future booking availability independent of unrelated today's attendance. UI availability summaries refresh after attendance changes and show conflicts clearly.

Complete when SC-003 passes through both manual and suggested starts, and browser evidence matches server eligibility. No timing policy may bypass database guards or silently alter an active visit.

## Stage 5 - Restore acceptance and package local P0 (P0, Medium)

Repair relevant harness/browser-global/selector/navigation failures and lint errors using supported patterns; do not weaken assertions to manufacture green checks. Extend only essential missing regressions. Run DB tests against an explicitly disposable database, including concurrent booking/starts, payment retries, reversals, payroll snapshots/approval, and repeated restock receipt. The existing test helper creates and drops schemas; inspect the connection target before exporting test URLs.

Complete when the P0 portions of SC-001 through SC-006 have local evidence, changed P0 screens have authenticated browser acceptance, README reflects resulting behavior, and a concrete rollout package lists hosted criteria still pending. P1 portions such as discounts and restored historical views remain unchecked until stage 6. Local P0 completion is not production readiness. Stop at the requested local phase boundary rather than beginning P1 automatically.

## Stage 6 - Complete launch workflows (P1, Small-Medium per item)

Execute separately authorized workstreams in this order where dependencies apply:

1. Restore branch-authorized historical booking visibility after deactivation.
2. Resolve D03 and align the public catalog; preserve service/branch selection across login with server revalidation.
3. Resolve D05 and implement audited discounts with receipt/report/refund/payroll compatibility. Keep original and net amounts distinct.
4. Resolve D04 and implement supported recovery with identity verification, abuse controls, secure handling, and session invalidation.
5. Confirm TLS trust and implement bounded database readiness. Preserve liveness semantics and non-sensitive errors.
6. Resolve D06 and prepare clean deployment/backup recovery procedures. Historical unknown payroll rates remain pending unless an authorized Manager supplies evidence.

Complete when each required P1 workstream's focused acceptance passes and every unapplied policy is listed explicitly. Discount implementation depends on pricing/permission decisions; recovery depends on the selected credential/delivery flow.

## Stage 7 - Verify the exact release (P1, Medium)

On an explicitly authorized isolated staging environment, perform a clean install, migrations, default production build/start, and the complete authenticated workflows in SC-007. Inspect changed screens at desktop, tablet, and mobile widths with keyboard/accessibility checks. Verify stock/revenue/payroll reconciliation and branch isolation after interactions.

Before hosted application of grants/migrations/deployment, present preservation evidence, exact target, proposed migration/release, and verification/rollback instructions. Following authorization, verify Data API protection and the deployed commit/migration state. Restore a backup into an isolated target, compare invariants to the recorded backup point, and measure recovery against D06.

Complete when SC-007/SC-008 and required release checklist entries pass for the named release. Local screenshots, source inspection, advisor output, or startup alone cannot satisfy these gates.

## Stage 8 - Optional improvements (P2)

Implement only explicitly selected settings, reminders, pagination, offline/installability, or additional UX work. Design each around its primary task using existing primitives. Keep authoritative details beneath summaries and preserve server rules. Background/offline support must not permit unauthenticated, duplicated, or stale financial mutations.

Complete when the selected enhancement has its own narrow acceptance evidence. These tasks are not part of the minimum local P0 goal.

## Completion report

Report scope completed, exact branch/commit and environment, requirement/task IDs, commands and actual results, browser evidence, migrations prepared/applied, preserved data, and remaining release blockers. Leave external or decision-dependent acceptance unchecked. Cite evidence instead of repeating the baseline audit as proof of a fix.
