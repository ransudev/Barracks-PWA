# Barracks user stories by account role

Drafted October 13, 2026 from application source at `6b65d8e`. These stories describe the existing product and permission rules; they do not grant new permissions or approve new business policy. Each story has observable acceptance criteria. [Test coverage and remaining gaps](verification.md) are recorded separately; having a story or passing a related unit test is not complete browser or hosted acceptance.

There are five login roles: **Administrator, Manager, Front Desk, Customer and Supplier**. Barbers are employee records without login accounts. Accountless walk-ins are customer records without login accounts; their workflows are included under Front Desk. A role means an account type, not an individual demo account.

## Shared account stories

### ACC-01 — Sign in to the appropriate workspace

As an account holder, I want to sign in securely so that I can use the workspace assigned to my role.

Acceptance criteria:
- Valid credentials for a verified, unblocked, undeleted account open its permitted workspace; invalid credentials do not create a session.
- Protected pages restore the current identity from the session on reload. Signed-out API requests are rejected with 401.
- A role cannot gain access to another role's private data by entering a URL or sending an API request directly.

### ACC-02 — Sign out and prevent continued access

As an account holder, I want to sign out so that someone else using the device cannot continue my session.

Acceptance criteria:
- Signing out returns me to sign-in and invalidates my current session.
- Subsequent protected requests require authentication; the previous workspace's private content is not available through normal navigation.
- Signing out does not alter business records or another user's account.

### ACC-03 — Work within the authorized branch or owner context

As an account holder, I want each action to use the correct branch or owner so that records stay with the right business context.

Acceptance criteria:
- Administrator branch reads may be global; Manager and Front Desk operations on branch-owned records use assigned branches. Shared customer/supplier identities retain their existing directory scope. Customer and Supplier ownership is derived from their signed-in account.
- A staff branch switch clears obsolete drafts/choices where appropriate and ignores delayed responses from the previous branch.
- Sending another branch or owner ID cannot bypass authorization. Existing records retain their persisted branch when acted on.

## Administrator stories

### ADM-01 — Manage branches and staff assignments

As an Administrator, I want to manage branches and staff memberships so that staff can work only in the branches they are responsible for.

Acceptance criteria:
- I can create and edit branch details and status, and assign staff to branches.
- A staff member has at most one primary branch; setting a new primary reconciles the previous primary.
- Non-Administrator requests to branch-management endpoints are denied before mutation; historical branch ownership is preserved.

### ADM-02 — Administer staff accounts safely

As an Administrator, I want to create and manage permitted staff accounts so that the shop has the correct people and roles.

Acceptance criteria:
- I can view staff globally and create Manager or Front Desk accounts with valid unique account details and branch assignments.
- Editing, verification, blocking and deactivation follow the target-account authorization matrix.
- I cannot deactivate myself or manage another Administrator through ordinary staff management; invalid input or unauthorized targets do not change records.

### ADM-03 — Maintain customer and supplier records

As an Administrator, I want to maintain customer and supplier records so that operations use accurate identities and contact information.

Acceptance criteria:
- Registered and accountless customer profiles can be edited; accountless editing never creates a user account or requires email/password.
- Customer deactivation is limited to registered customers and is blocked by active appointments; retained history remains available.
- I can deactivate suppliers and create one linked supplier login. Duplicate email or existing linkage is rejected, and inactive suppliers lose supplier-owned scope.

### ADM-04 — Maintain the service catalog and barber settings

As an Administrator, I want to maintain services and barber settings so that appointments use valid offerings and schedules.

Acceptance criteria:
- I can create/edit services and barber records and manage branch schedules, breaks and time away.
- Archiving a service removes it from new-visit choices while preserving history; deletion is allowed only when no booking, queue or transaction usage exists.
- Sensitive barber controls remain Administrator-only. Commission changes use Payroll's effective rate and audit workflow; no bulk overwrite of historical commission is allowed.

### ADM-05 — Review business performance and audited financial records

As an Administrator, I want to review sales, stock, transactions and financial corrections so that I can understand the business without losing its audit history.

Acceptance criteria:
- Reports support authorized single-branch and global scope, with Manila date filters and saved transaction snapshots.
- Management can reopen receipts and request permitted reasoned refunds; the original sale, tender and correction audit remain intact.
- Checkout remains Front Desk-only. Merely switching to the Front Desk workspace does not authorize Administrator queue, booking-lifecycle or checkout writes.

### ADM-06 — Prepare payroll without bypassing approval

As an Administrator, I want to prepare payroll and view its progress so that barber compensation can be managed with an audit trail.

Acceptance criteria:
- I can use authorized payroll configuration, rate, generation and payment actions under their state rules.
- Only an assigned Manager can approve payroll or correct eligible unresolved snapshots; Administrator approval attempts are rejected.
- Approved/paid breakdowns are immutable, and missing historical rates remain unresolved until supported by an evidenced correction.

## Manager stories

### MGR-01 — Manage Front Desk staff within my authority

As a Manager, I want to manage Front Desk staff in my branches so that I can maintain operational staffing.

Acceptance criteria:
- My staff view includes Front Desk accounts whose memberships overlap my assigned branches.
- Global account changes are allowed only when all target memberships are within my authority; a partially shared account remains viewable with restricted actions.
- I cannot create/manage Manager or Administrator accounts, assign branches outside my authority or bypass current membership revalidation.

### MGR-02 — Maintain barber schedules and correct attendance

As a Manager, I want to maintain branch barber schedules and review attendance so that staffing records reflect actual operations.

Acceptance criteria:
- I can manage authorized barber profiles, shifts, breaks and time away, and read attendance history using Manila calendar dates.
- A historical attendance correction requires a reason and adds an immutable correction record while preserving the stored branch.
- I cannot delete barbers or submit Administrator-only commission/rating fields; clock-out is blocked while a barber is serving a customer.

### MGR-03 — Maintain customers, suppliers and service offerings

As a Manager, I want to update operational profiles and the catalog so that staff have accurate information.

Acceptance criteria:
- I can edit permitted customer details and loyalty points, including accountless walk-in contact details without creating accounts.
- I can create/edit suppliers and services and archive/restore services; a used service cannot be deleted.
- I cannot deactivate suppliers, create supplier logins or use Administrator-only customer deactivation controls.

### MGR-04 — Manage stock and receive deliveries

As a Manager, I want to request and receive supplies for my branches so that stock levels and movement history stay accurate.

Acceptance criteria:
- I can read/update authorized branch inventory, review alerts and movements, and create a restock request for active supplier-linked items.
- A shipped request can be marked Delivered; receiving it records actual quantities/costs and updates stock and movement history transactionally.
- Invalid transitions, another branch's records and duplicate receiving are rejected; simultaneous stock use cannot consume more than available stock.

### MGR-05 — Review sales and make accountable financial corrections

As a Manager, I want to review transactions and branch reports and perform permitted corrections so that financial records can be reconciled.

Acceptance criteria:
- I can filter reports and transaction history within my assigned branches and reopen saved receipts.
- Refunds require a valid reason and amount, retain the original transaction and are serialized against duplicate/conflicting corrections; post-payment void is rejected.
- I cannot create checkout transactions, operate the Front Desk queue or advance booking service state, even through direct requests.

### MGR-06 — Review and approve payroll

As an assigned Manager, I want to review payroll before approval so that barber earnings are supported by recorded services and rates.

Acceptance criteria:
- Payroll shows the configured consecutive 14-day Manila period and saved commission breakdowns for an authorized branch.
- Only eligible Pending Approval records can be approved; returning a record requires a reason. Missing rates require an evidenced correction before finalization.
- Approved/paid details cannot be rewritten; adjustments and supplemental records follow their separate audited state rules.

## Front Desk stories

### FD-01 — Review today's workload

As Front Desk, I want to see the current queue, bookings and barber availability so that I can decide the next operational action.

Acceptance criteria:
- The dashboard reads persisted active queue and booking data for my selected branch.
- Availability follows server eligibility, including attendance, current service, shift, hours, breaks, absences and reservations.
- Loading, empty and failed reads are distinguishable; a failed request is not displayed as a successful zero count.

### FD-02 — Create a valid registered-customer appointment

As Front Desk, I want to reserve an available slot for a registered customer so that the customer has a valid appointment.

Acceptance criteria:
- The customer picker excludes accountless profiles; only eligible registered customer records can be selected.
- Service/barber/date changes clear the time, and the server revalidates availability, account eligibility and branch ownership when saving.
- A missing or newly ineligible customer selection is cleared and cannot submit. A valid booking persists its assigned barber, branch, price/duration snapshots and notes; concurrent overlap is rejected.

### FD-03 — Check in and serve appointments

As Front Desk, I want to advance appointments through their supported states so that the schedule and queue stay consistent.

Acceptance criteria:
- Check-in creates one linked ready Queue entry. Start and completion update booking and queue together with ordered server timestamps.
- Starting requires a full service interval to fit current eligibility; the booking's own reservation does not block its service start.
- Cancellation removes an eligible linked Queue entry. No-show requires a confirmed booking beyond the Manila grace period; invalid/terminal transitions do not change state.

### FD-04 — Add and serve accountless walk-ins

As Front Desk, I want to add a walk-in using a name and optional phone so that the person can receive service without registering an account.

Acceptance criteria:
- Creating the profile and Queue entry is one transaction; retrying the same idempotency key does not duplicate either record.
- An unassigned walk-in waits; assignment makes it ready, clearing assignment returns it to waiting, and start/completion follow the guarded lifecycle.
- No user account, email or placeholder password is created. The profile can still be edited/reused in Queue, while a direct appointment request remains rejected.

### FD-05 — Review and confirm the next customer

As Front Desk, I want a server-validated next-customer suggestion so that I can assign a suitable barber without skipping eligibility checks.

Acceptance criteria:
- The suggestion respects checked-in appointment priority, ready/waiting ordering and full-duration fit within the selected branch.
- Reviewing a suggestion does not alter state. Confirming an unassigned suggestion rechecks order/availability and makes it ready; it does not start service.
- A stale or unavailable suggestion is rejected and must be requested again; terminal visits never become candidates.

### FD-06 — Take payment and reopen a receipt

As Front Desk, I want to charge a completed unpaid visit so that the customer receives an accurate saved receipt.

Acceptance criteria:
- Only a completed unpaid booking or walk-in is eligible; booking-linked Queue visits are paid by booking ID.
- Cash received must cover the saved total; non-cash omits cash fields. Duplicate checkout creates no second sale or tender.
- A saved receipt reopens with immutable visit/payment snapshots. Refund/void controls and management correction details are not available to Front Desk.

### FD-07 — Maintain customers and today's barber attendance

As Front Desk, I want to correct contact information and mark today's attendance so that service can proceed with accurate operational records.

Acceptance criteria:
- Registered and accountless profile names, phone and preferred barber can be edited; accountless editing requires no login fields and preserves loyalty points.
- I can mark today's Present/Late/Absent and clock-in/out for branch barbers; absence/clock-out blocks new starts, and an active service blocks clock-out.
- I cannot edit loyalty points, deactivate customers, manage staff/schedules, access attendance corrections/history, manage stock or access Payroll/Reports.

## Customer stories

### CUS-01 — Register for a customer account

As a new customer, I want to register with my identity and contact details so that I can sign in and book appointments.

Acceptance criteria:
- Valid registration creates a customer-role user and linked profile; invalid contact details, duplicate email or extra privileged fields are rejected.
- Registration does not create staff, Administrator or Supplier access.
- Accountless Queue profiles remain distinct unless an explicit supported linking workflow is adopted; registration does not silently grant an existing walk-in appointment eligibility.

### CUS-02 — Maintain my profile

As a Customer, I want to view/update my contact details and preferred barber so that my reservations use accurate information.

Acceptance criteria:
- Reads and edits use my authenticated customer profile rather than a caller-selected customer ID.
- Invalid contact data is rejected; my loyalty balance is displayed but cannot be directly changed by my request.
- Another customer's profile and all staff/supplier workspaces remain inaccessible.

### CUS-03 — Book at my chosen active branch

As a Customer, I want to choose an active branch, service and available slot so that I can reserve the visit that suits me.

Acceptance criteria:
- The form offers active services and eligible barbers/slots for the selected branch, including Any Available Barber.
- Switching branch clears obsolete appointment choices and ignores delayed responses; saving revalidates account, branch and availability.
- Confirmation displays the persisted booking ID, branch, assigned barber, date/time, price and notes; a forged customer ID cannot create someone else's appointment.

### CUS-04 — Review, reschedule or cancel my appointments

As a Customer, I want to review my booking history and change an eligible upcoming appointment so that I can keep my plans current.

Acceptance criteria:
- History includes my appointments across branches and shows persisted status and branch.
- Only my confirmed bookings can be edited or cancelled; editing uses the appointment's saved branch and fresh availability.
- I cannot access another customer's booking, advance service states or delete a booking. An inactive persisted branch blocks rescheduling but preserves cancellation/history access.

### CUS-05 — Recover access when I cannot sign in

As a Customer, I want a secure account-recovery flow so that I can regain access without exposing my password.

Acceptance criteria for future acceptance:
- A documented recovery method verifies the requester, expires recovery authority and prevents reuse.
- The flow does not reveal whether unrelated accounts exist or disclose passwords/secrets in responses, logs or evidence.
- This is an **open P1 story**, not a claim that a working recovery flow is implemented; a Forgot password button alone does not satisfy it.

## Supplier stories

### SUP-01 — See my linked supplier business

As a Supplier, I want to see my linked company and supplied items so that I can understand what the shop orders from me.

Acceptance criteria:
- The signed-in supplier linkage selects the company and its supplied-item/request data.
- An unlinked or inactive supplier has no supplier-owned scope; another company's records are inaccessible even with a forged identifier.
- The portal does not expose staff, customer, payment or payroll workflows.

### SUP-02 — Review and fulfill my restock requests

As a Supplier, I want to progress my requests through fulfillment so that shop staff know their delivery status.

Acceptance criteria:
- I can read only my supplier's requests and line details, including the saved destination branch.
- Supported fulfillment follows Pending → Accepted → Preparing → Shipped; invalid transitions and another supplier's request are rejected.
- I cannot mark a request Delivered/Received or increase branch stock. Shop management confirms delivery and receiving.

### SUP-03 — Review delivery history

As a Supplier, I want to review retained request/delivery status so that I can follow up on outstanding and completed orders.

Acceptance criteria:
- The portal separates current request statuses and retained delivery history using persisted data.
- A reload shows the saved status, while renamed live inventory/supplier records do not rewrite stored historical request/movement snapshots.
- The history remains restricted to my linked supplier; viewing it does not mutate an order.

### SUP-04 — Change my password securely

As a Supplier, I want to change my password using my current password so that I can maintain access to my account.

Acceptance criteria:
- The current password must verify, the new password must satisfy validation and differ from the current one, and only my account is updated.
- Invalid current/new credentials leave the hash unchanged; successful updates store a hash, never plaintext.
- This story has an implemented API but its successful/negative runtime cases still need dedicated verification; see the coverage gaps.

## Acceptance and testing rules

For each story, run both its happy path and rejection cases. Use local disposable data for database tests and record the exact source/environment. UI visibility is not backend authorization. Passing a module test proves only its asserted behavior; story acceptance also needs the remaining UI, authentication and end-to-end steps.

Do not make a story pass by broadening permissions, inventing historical duration/rates, changing production hours/attendance or inserting production fixtures. Hosted tests, writes and deployments require their own authorized scope. Account recovery, email confirmations, calendar synchronization, exhaustive mobile/accessibility acceptance and restore/recovery evidence remain separate open work rather than assumed capabilities.

Source anchors: [`ApiRole`](../../barracks-pwa/app/lib/api.ts), [page access map](../../barracks-pwa/app/constants/navigation.ts), [backend role guards](../../barracks-pwa/server/auth/require-role.ts), [staff authorization](../../barracks-pwa/server/services/user.service.ts), [booking validation](../../barracks-pwa/server/services/booking.service.ts), [Queue lifecycle](../../barracks-pwa/server/services/queue.service.ts), [payroll policy](../../payrollspec.md), [readiness checklist](../001-production-readiness/checklist.md).
