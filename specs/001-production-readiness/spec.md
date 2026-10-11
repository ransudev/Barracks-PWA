# Specification: secure and reliable Barracks operations

Date: 2026-10-11. Status: Local P0 implemented; P1 decisions pending. Feature: `001-production-readiness`.

## Outcome and scope

Make the existing multi-branch application safe and consistent from booking or walk-in registration through service, payment, payroll, inventory, and reports. Preserve existing financial history and established roles. Improve behavior within existing screens; a broad redesign is outside this feature.

Audit references F01-F13 refer to the report in this chat. [evidence.md](evidence.md) preserves the baseline and its limitations. Reproduce applicable findings before choosing the final implementation. A source finding, dependency advisory, or test failure is not automatically evidence of an exploited production defect.

| Priority | Included work | Audit references |
| --- | --- | --- |
| P0 | Database API protection; staff branch authorization; attendance and interval eligibility; dependency remediation; regression acceptance | F01-F05, F11 |
| P1 | Historical booking visibility; public catalog alignment; approved discount workflow; account recovery; TLS, readiness, deployment and recovery | F06-F10, F13 |
| P2 | Required settings, reminders, pagination, installation/offline support, further accessibility and UX refinement | F12 and optional improvements |

## User stories and acceptance scenarios

### US1 - Protect user and branch data (P0)

An Administrator can operate across the system; a Manager can operate only within assigned authority; Front Desk, Customer, Supplier, and anonymous clients retain their intended boundaries.

- An anonymous or Supabase-authenticated API client cannot read or write internal operational/payroll tables or invoke a function that provides equivalent access.
- Server-side application access still completes authorized operations after protection is applied.
- Manager A cannot list branch-B-only staff or update their credentials, role, lifecycle, or global profile by changing an ID.
- Unassigned and shared staff follow D01; membership revocation racing with a mutation cannot authorize an otherwise forbidden change.

### US2 - Assign only an eligible barber (P0)

Front Desk sees the reason a barber cannot serve and receives the same decision from manual and suggested service-start actions.

- Explicitly absent or clocked-out staff cannot start a new service today.
- Missing attendance has its own state and follows D02; it is not inferred as absence.
- At 10:45 Manila, a 45-minute service cannot start before an 11:00 appointment or break.
- A service ending exactly when the next block starts is allowed when all other rules permit it.
- Two concurrent starts for one barber result in at most one active service, with a useful conflict response for the other request.
- Starting an appointment excludes its own reservation from collision checks while checking other reservations and actual duration.

### US3 - Trust payments and historical records (P1, with P0 regressions)

Staff can inspect retained history, customers see authoritative prices, and approved discounts affect payment without changing the commission basis.

- Deactivating a customer disables login and retains staff-visible historical bookings, receipts, and payroll evidence.
- A public bookable service uses the operational catalog price/variant; service and branch selections survive a login detour where valid.
- A PHP 300 original price with an authorized PHP 50 discount charges PHP 250. At a 40% snapped rate, commission remains PHP 120.
- Refunding that PHP 250 reverses net revenue by PHP 250 and preserves PHP 120 earned commission.
- Retrying checkout cannot create another transaction/tender; incomplete services remain ineligible.

### US4 - Recover access and operate a deployable service (P1)

Support can restore a legitimate customer's access, and operators can tell whether the application can reach its database and recover from failure.

- Recovery follows D04, avoids account-enumerating public responses, and invalidates superseded credentials/sessions as defined by the selected flow.
- A database readiness check fails within a bounded deadline when PostgreSQL is unavailable; liveness remains separately identifiable.
- A clean supported environment installs, migrates, builds, starts, and completes the required role/branch workflows.
- An isolated restoration proves retained transactions, branch ownership, stock, and payroll integrity against a recorded backup point.

## Functional requirements

### Security and permissions

- **FR-001:** Inventory exposed schemas, tables, sequences, views, functions, grants, default privileges, and dependent clients before changing database access. Protect internal objects from `anon` and `authenticated` clients through least-privilege grants and appropriate RLS/schema exposure. Enabling RLS alone is not the full acceptance test.
- **FR-002:** Deliver new numbered, preservation-safe migrations through the existing migration runner. Keep payroll deny rules effective and retain the backend database role's required access. Final grants and function execution rights must be explicitly reviewed.
- **FR-003:** Authorize each staff list/detail/create/update/lifecycle/delete action using current actor and target memberships, not a client branch parameter or navigation visibility. Manager-created Front Desk accounts and authorized initial memberships must commit atomically. Administrators retain intended global access and existing last-administrator protections.
- **FR-004:** Upgrade affected dependencies based on current authoritative advisories and actual feature/hosting exposure. Record remaining advisories with severity, scope, and disposition; an unresolved exploitable critical/high runtime advisory blocks release.

### Attendance and service start

- **FR-005:** Provide one authoritative operational eligibility result with a stable reason and relevant interval. UI counts and actions must consume its meaning rather than independently reinterpret raw barber status.
- **FR-006:** Validate current attendance, status, active service, branch, shop hours, shifts, breaks, time away, and overlapping appointments inside service-start transactions. Use an authoritative clock and the immutable visit duration; catalog edits must not change an existing visit's timing decision.
- **FR-007:** Preserve database overlap/active-service guards as concurrency arbiters. Lock relevant records in a consistent order and recheck mutable authorization and scheduling inputs. Conflicts return a structured response and leave no partial queue/booking transition.
- **FR-008:** Today's attendance affects today's new starts only. Explicit absence does not indefinitely block future-date booking. Clock-out during an active service follows D02 without silently completing/removing a visit.

### Pricing, checkout, history, recovery

- **FR-009:** Active-customer eligibility must be separate from historical reads. Staff history remains visible after deactivation under its original branch permissions; deactivated customers retain no login access.
- **FR-010:** Advertised bookable offerings, prices, duration, and availability must correspond to authoritative supported catalog data. Handle retired or changed selections explicitly. D03 defines whether Junior/Senior variants are implemented or removed from bookable advertising.
- **FR-011:** Discounts follow D05. Persist original amount, discount amount, net paid amount, reason, actor, and any required approval. Validate bounds and permissions server-side; changing the client payload cannot change the visit's original price or bypass approval. Make receipt/report totals reconcile.
- **FR-012:** Existing no-discount checkout clients retain their current behavior. Legacy financial snapshots remain intact and receive no fabricated discount/approval evidence. Apply refund amounts to the actual net paid amount while preserving established full-refund and payroll rules.
- **FR-013:** Implement the selected recovery flow with verified identity, least privilege, abuse controls, secure token/password handling, and audit events without secrets. Passwords, reset tokens, and API/database credentials must not appear in logs or evidence.

### Operations and usability

- **FR-014:** Verify PostgreSQL server identity when TLS is enabled using the appropriate trust configuration. Keep supported connection-pool behavior and document local versus hosted settings without storing credentials.
- **FR-015:** Provide bounded readiness with non-sensitive failure responses. Record required environment variables, exact release and migration state, deployment steps, secure rollback/forward-fix strategy, and restore ownership. Recovery targets require D06.
- **FR-016:** Preserve valid branch/service context across booking navigation and authentication without silently choosing an ambiguous branch. Validate the restored selection on the server.
- **FR-017:** Changed screens show loading, empty, stale/error, success, and conflict states honestly. Failure retains recoverable input; branch switching cannot display previous-branch results as current. Provide keyboard operation, visible labels/focus, and responsive controls using existing components.
- **FR-018:** Use focused existing tests and add only missing high-value regressions required by this spec during authorized implementation. Every acceptance claim identifies code-only, local runtime, browser, staging, or production evidence. Skipped/blocked criteria remain unchecked.

## Business invariants

`../../payrollspec.md` governs confirmed payroll rules despite any stale implementation-status text in that document:

- Commission only, individually configured rates, original price before discounts, tips excluded, and completed-plus-paid eligibility.
- Snapshot the rate at service completion; later catalog/rate changes do not change earned commission.
- Refunds retain earned commission. Post-payment void behavior remains restricted until separately decided; this spec does not redefine it.
- Contiguous 14-day Asia/Manila periods, originating-branch ownership, Manager approval before Paid, and immutable approval/payment history.
- Unresolved historical rates remain explicitly unresolved; confirmation is an audited Manager action, never an inferred default.

Use PHP integer centavos or exact NUMERIC for financial calculations, with a documented consistent round-to-centavo rule. Use half-open scheduling/payroll intervals and Asia/Manila calendar boundaries. Completed-service checkout, unique tenders, append-only financial evidence, stock integrity, and transactional restock receipt remain protected.

## Entities and contracts affected

| Area | Expected contract work |
| --- | --- |
| Database authorization | Object grants/default privileges and exposure; no operational row rewrites |
| Users and memberships | Actor/target scope for staff APIs; atomic account/membership creation |
| Attendance and visits | Shared eligibility reasons; visit-duration validation; existing queue/booking states retained |
| Services | Authoritative public projection or approved explicit variants; historical snapshots retained |
| Transactions/tenders/actions | Additive discount evidence if approved; original versus net totals remain distinct |
| Recovery | Selected support reset or expiring-token flow; authenticated authorization and session invalidation |
| Health | Distinct liveness/readiness behavior with bounded dependencies |

Inspect actual schemas/contracts before naming new columns or endpoints. Document every additive field and compatibility behavior in the implementation evidence. Avoid a new framework, ORM, authentication replacement, or universal UI redesign.

## Decision records

D01 and D02 were confirmed by the owner on 2026-10-11: "Adopt both draft policies". D03–D06 remain proposed policies. Resolve only the decisions needed by an authorized phase; continue independent work while a decision is pending.

| ID | Decision | Recommended draft | Required before |
| --- | --- | --- | --- |
| D01 | Shared/unassigned staff authority | Managers see staff with an assigned-branch overlap, expose only authorized memberships, and change a global account only when all target memberships are within their authority. Administrator manages unassigned or wider shared accounts. Manager creation assigns explicit authorized branches atomically. | Staff mutation implementation |
| D02 | Attendance requirement and active clock-out | Block explicit Absent and Clocked out; leave Unmarked distinct and eligible only if other rules pass. Reject clock-out while serving with an actionable message until service is completed. Decide separately whether clock-in becomes mandatory. | Attendance integration |
| D03 | Junior/Senior service variants | First align bookable advertising to the existing catalog; add variants only if the owner confirms pricing rules and barber classification. | Public pricing changes |
| D04 | Customer recovery method | Minimum supported Administrator reset after documented identity verification and secure credential handoff; self-service email reset requires a confirmed delivery provider. | Recovery implementation |
| D05 | Discount authority and bounds | Assigned Manager/Administrator authorizes a fixed PHP amount and reason for a visit; Front Desk applies server-recorded approval. Bounds are zero through original price, with explicit decision on zero-net service eligibility. | Discount schema/API work |
| D06 | Recovery targets | Owner/operator chooses RPO, RTO, retention, and restore responsibility based on available backups. Demonstrate the selected targets in an isolated restore. | Production recovery sign-off |

No arbitrary monetary caps, attendance mandate, shared-account permission, email provider, or recovery target may be silently invented.

## Measurable success criteria

- **SC-001:** Negative API/database cases deny unauthorized reads and writes across all inventoried internal objects while authorized server workflows pass.
- **SC-002:** Staff authorization scenarios cover Administrator, assigned Manager, foreign Manager, shared/unassigned targets, and membership revocation.
- **SC-003:** Eligibility scenarios cover absence, clock-out, Unmarked, breaks, shift end, appointment collisions, exact boundaries, own-booking exclusion, changed catalog duration, and simultaneous starts.
- **SC-004:** Checkout/refund/payroll regressions prove original/net/commission separation, retries, rate changes, historical visibility, and unchanged approval rules.
- **SC-005:** Restock receipt and inventory regressions prove idempotency, branch boundaries, correct movements, and non-negative stock under competing operations.
- **SC-006:** Required tests, lint, type checks, supported build/start, and dependency disposition pass for the exact candidate commit. Critical DB tests do not pass by being skipped.
- **SC-007:** Authenticated browser evidence covers booking, walk-in, attendance, checkout/refund, payroll, restock, and branch switching at representative desktop/tablet/mobile sizes; required accessibility checks are recorded.
- **SC-008:** Exact deployed release, live database protection, verified TLS, dependency readiness, migration compatibility, and isolated backup restoration have evidence within chosen operational targets.

Production acceptance requires all applicable criteria. Optional P2 items are excluded only through an explicit release scope, not by marking them passed.
