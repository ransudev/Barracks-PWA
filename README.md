# Barracks Barbers & Shaves

Barracks is a Next.js App Router PWA prototype for barbershop operations. The active application lives in `barracks-pwa/` and combines a public landing page, customer booking/account flows, staff operations, administrator management, and a PostgreSQL-backed sprint implementation.

This is the canonical project guide. It combines the product context, design direction, runtime architecture, codebase map, API contract, database notes, and current limitations in one place. The two supporting documents stay focused on their specific jobs:

- [Running Barracks locally](running.md) covers environment setup, migrations, seeding, and troubleshooting.
- [Demo guide](DEMO_README.md) covers demo accounts, seeded showcase data, and the recommended walkthrough.

## Quick start

From `barracks-pwa/`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For database-backed screens, configure the variables in `barracks-pwa/.env.example`, export them in the shell, then run:

```bash
npm run db:migrate
npm run db:seed-admin
npm run db:seed-demo
```

To reset the configured administrator password after the database has been migrated, update `INITIAL_ADMIN_PASSWORD` in `barracks-pwa/.env.local`, export the environment values, and run `npm run db:reset-admin`. The command updates the administrator account identified by `INITIAL_ADMIN_EMAIL` and revokes its existing sessions.

The full setup sequence is in [running.md](running.md). On an empty local database, the demo seed creates a Sprint 2 showcase dataset for barbers, suppliers, supplier accounts, linked inventory, restocks, receiving history, customers, bookings, and a transaction. Once a transaction exists, Phase 5 protects that financial record from deletion, so the demo seed cannot be rerun against that database.

Demo credentials:

- Front Desk: `demo.frontdesk@barracks.local` / `frontdesk123`
- Manager: `demo.manager@barracks.local` / `manager123`
- Customer: `demo.customer.ana@barracks.local` / `customer123`
- Supplier: `demo.supplier.nina@barracks.local` / `supplier123`

## Product and sprint scope

Barracks connects the daily rhythm of a barbershop—bookings, barber availability, customers, inventory, and management oversight—inside one shared product. Staff need fast scanning and low-friction updates on the shop floor; administrators need a wider business view; customers need a simple account and booking path.

The active `sprint-2` experience includes:

- Public landing page with Barracks branding, service information, branches, contact details, and login/customer-account actions. Its full-bleed hero uses a landscape adaptation of the real Barracks shop photo at `barracks-pwa/public/barracks/hero-barracks-landscape.png`, retaining the Barracks uniform and lightly altering the faces; it pairs with a left-aligned Barracks lockup, red establishment kicker, appointment/service actions, bottom benefits rail, responsive navigation/footer rules, smooth anchor scrolling, scroll-linked image depth, staged section reveals, fully visible responsive service numerals, and compact inline icon labels.
- Customer and supplier phone inputs are capped at 11 characters in the UI and server schemas, with the API enforcing the same limit for signup, profile, customer-management, and supplier-management payloads.
- Staff management is available to administrators and managers: administrators can view all staff accounts and create, edit, manage lifecycle, and deactivate permitted accounts, but cannot deactivate themselves or manage another administrator account; managers can view and manage front-desk accounts only.
- Customer signup, login, profile details, preferred barber, loyalty points, booking, and appointment history.
- Front Desk workspace with a live barber overview dashboard, queue, bookings, payments, customers, and a Barber Floor view with daily status controls. The dashboard shows the active queue count and a preview from `/api/queue?view=active`.
- Management workspace with dashboard counts, staff account management, barber management, inventory, suppliers, restocks, inventory reporting, and payment-derived sales reporting.
- Supplier portal for a linked supplier account, its supplied items, deliveries, and restock requests.
- PostgreSQL-backed CRUD for user accounts, barber employee profiles, services, inventory, suppliers, and restock requests, plus database-backed booking creation/editing/status updates.
- Shared operational card/list/drawer modules that give customers, barbers, staff accounts, suppliers, restocks, bookings, queue, and inventory one consistent interaction language.
- Role-aware workspace switching between Management and Front Desk.

The app uses URL-backed Next.js routes for the active surfaces. The browser restores the requested page after refresh, and protected routes rehydrate the current account from the HTTP-only session cookie before rendering the workspace.

### Scheduling foundation

Migration `010_scheduling_availability.sql` stores seven shop operating days, recurring barber shifts and breaks, and timestamped barber unavailable periods. Hours are initially 9:00 AM–7:30 PM daily in Asia/Manila. Existing barbers receive matching shifts during migration; newly created barbers receive seven shifts based on the current shop hours in the same transaction as the new profile. Administrators and managers can edit these in Barber Management, where the scheduling panel follows the roster layout and incomplete schedules are flagged. A missing schedule day offers no appointment slots. Front Desk and customers can read shop hours but cannot change schedules.

`GET /api/shop-hours` returns the weekly hours and timezone; `PUT /api/shop-hours` updates one day for management roles. Management can use `GET/PUT/POST/DELETE /api/barbers/:id/schedule` to read or change shifts, breaks, and unavailable periods. `GET /api/bookings/availability?serviceId=...&barberId=...&date=YYYY-MM-DD` is available to customers, Front Desk, managers, and administrators. Omitting `barberId` returns the union of slots across available barbers. Slots respect shop hours, working shifts, breaks, temporary absences, active bookings, current Philippine time, and the barber's globally unavailable status. A busy barber remains schedulable for future free times. Booking creation and editing revalidate the slot on the server. Any Available Barber selects the eligible barber with the fewest active appointments on the date, then the lowest ID. Migration `011_booking_overlap.sql` adds PostgreSQL exclusion constraints for active barber and customer intervals, including concurrent writes; adjacent appointments remain valid.

Customer and Front Desk booking forms use these server-generated slots, clear a selected time whenever the service, barber, or date changes, and show an appointment review before submission. Customers may choose Any Available Barber and receive an on-screen confirmation with the assigned barber, booking ID, price, notes, and status. Customers can edit or cancel their own confirmed bookings; checked-in and later appointments are read-only. Front Desk can check in, start service, complete, cancel eligible bookings, or mark a confirmed booking no-show after a staff-triggered 10-minute Asia/Manila grace period. The API enforces each transition. Operational branch scoping and notifications remain deferred; branch identity and staff assignments are implemented in Phase 1.

Queue management uses `queue_entries` in PostgreSQL. From Add to Queue, front desk can select an existing customer or create a walk-in record with a name and optional phone, then continue with service and optional barber selection. Creating that customer record and its queue entry is one transaction; no login account or placeholder credentials are created. Migration 016 allows customers without a linked user and stores their name, while registered customer accounts keep working as before. Queue submissions require an idempotency key so retries cannot create duplicate customer or queue rows. A walk-in without a barber starts `waiting`; assigning or changing a barber makes it `ready`, and clearing the barber returns it to `waiting`. Only `ready` entries can start service (`in_progress`), and only an `in_progress` entry can be completed. Waiting or ready walk-ins can be removed; completed and removed entries are terminal. Start and completion timestamps are set once and remain ordered. The shared lifecycle helper checks transitions, and migration 015 enforces state and timestamp consistency in PostgreSQL; existing invalid rows must be reconciled before that migration can apply. Check-in creates one booking-linked ready entry; starting, completing, or cancelling a checked-in booking updates booking and queue together in a transaction. Generic walk-in operations reject booking-linked entries. Assignment means ready for handoff; it does not start service. The server checks the barber's manual unavailable block, active service, current Manila shop/shift hours, scheduled breaks, and temporary absences at assignment and again at start. The stored `busy` status is a legacy manual value, not live queue state; an `in_progress` queue entry determines whether the barber is serving someone. A transaction locks the barber row before starting, and migration 014 adds a partial unique index so even simultaneous or direct database writes cannot create two active services for one barber. The Queue page reads the API on reload and displays rejection messages from the server. The Payments page shows checkout of completed unpaid bookings and walk-ins to Front Desk, while Manager and Administrator use transaction history and refund/void controls. It shows searchable, filterable, paginated transaction history from PostgreSQL and can reopen printer-friendly receipts from saved transactions. Settings, calendar sync, notifications, email confirmations, and complete visit history remain outside the active sprint screens. Service management uses the PostgreSQL catalog. The `/admin/reports` surface serves inventory reporting through `GET /api/reports/inventory` and sales reporting through `GET /api/reports/revenue`; the larger reporting prototype remains in the repository as reference material. The unused static data barrel, empty booking/queue fixtures, and test-only booking-list helper were removed; live screens continue to read their APIs.

The Queue page also offers a front-desk **Next Customer** action for a selected operationally available barber. The server first suggests the oldest `ready` entry assigned to that barber, then the oldest unassigned `waiting` walk-in; ties use queue ID. It excludes started, completed, removed, and un-checked-in appointment entries. Staff review the customer, service, check-in time, and assignment before acting. Confirming an unassigned suggestion rechecks availability and queue order, then assigns the barber and moves the entry to `ready`; the separate Start Service action remains in the queue drawer. A changed suggestion must be requested again.

The Queue page defaults to **Active** (`waiting`, `ready`, `in_progress`) and has a read-only **Completed Today** view. The latter shows customer, service, barber, visit type, and start/completion times for entries whose completion instant falls within the current `Asia/Manila` calendar day. The API filters both views in PostgreSQL; older completed and `removed` entries do not appear in either normal view. Both views retain joined-time and ID ordering. The staff dashboard requests the active view for its count and preview.

Barber Floor now shows today's attendance beside each barber's separate operational status. Front Desk can mark Present, Late, or Absent and clock a barber in or out there. Manager and Administrator have an Attendance page that defaults to today's records, with date, barber, and status filters for history; record details include a correction form and saved correction history. Attendance dates remain Manila calendar dates in API responses regardless of server timezone. Barbers remain business records without login accounts. Attendance does not calculate pay or alter queue availability.

Every queue API record includes a derived `visitType`: `walk_in` for an entry without a booking and `appointment` for a booking-linked entry. Appointment records also return the booking's scheduled date and time, current booking status, and existing assigned barber; the queue table does not copy these booking fields. Active cards and lists show a visit-type badge and scheduled appointment time. Next Customer labels a booked suggestion as a checked-in appointment and keeps the existing ready-before-waiting selection order. Confirmed bookings are not in the active queue; even an inconsistent queue row linked to a confirmed booking is filtered out. The completed-today view labels both visit types. Appointment service actions remain in Bookings, where booking and queue status changes stay transactional.

### Roles and access

There are five account roles:

- `administrator`: can enter Management and Front Desk, manage staff accounts and sensitive controls, and read operational data. Daily queue, booking lifecycle, and checkout writes remain Front Desk-only.
- `manager`: uses the Management workspace for Front Desk accounts, customers, barber roster and schedules, suppliers, inventory, restocks, reports, transactions, services, commissions, and attendance history/corrections. Managers can manage front-desk staff accounts only, read queue and bookings, and perform refund/void actions. Managers cannot perform Front Desk queue, booking, or checkout writes, deactivate suppliers, or use Administrator-only deletion.
- `front_desk`: works in Front Desk on customers, queue, bookings, checkout, barber operational status, and today's barber attendance. It can read transactions and make daily operational changes, but cannot access attendance history/corrections, inventory, suppliers, restocks, reports, roster editing, schedules, shop-hour mutations, financial adjustments, or staff-account management. Only administrators can hard-delete bookings.
- `customer`: can access only their own customer dashboard/profile and booking flow, including editing or cancelling their own upcoming bookings; customers cannot complete or delete bookings.
- `supplier`: can access the supplier portal for the linked supplier account and its restock requests.

Barbers are business records, not login identities. They do not have accounts or sessions. The migration reassigns legacy `barber` user rows to `front_desk` and removes the obsolete role.

The page-access map in `app/constants/navigation.ts` and `app/utils/view.ts` classifies Front Desk operational routes, shared Payments, and Management routes for direct URL access and navigation. Front Desk cannot open Management pages by URL, and Manager cannot open Front Desk-only pages. Older `/staff/inventory`, `/staff/suppliers`, and `/staff/restocks` URLs redirect authorized management users to their `/admin` equivalents. Sensitive Administrator-only controls remain inside management pages and are guarded by the API. Barber deletion, supplier deactivation and login creation, and bulk commission changes require Administrator; Manager retains individual barber commission and schedule management. The Front Desk Barber Floor changes operational status through `/api/barbers/:id/status` and today's attendance through `/api/attendance/today/:barberId`. Payments shows checkout only to Front Desk and refund/void controls only to management; Front Desk receipts omit correction reasons and responsible staff details. API guards enforce the same split.

Front Desk navigation shows Dashboard, Queue, Bookings, Payments, Customers, and Barber Floor. Manager and Administrator each have their own navigation array with Dashboard, Staff, Customers, Barbers, Attendance, Suppliers, Restocks, Reports, Transactions, Inventory, and Services. The shared payment route stays in the Management shell for Manager and Administrator and in the Front Desk shell for Front Desk.

The financial audit panel is shown only in Management. Front Desk receipts still show payment status without refund or void audit details.

## Design direction

### North star

The product follows a restrained Barracks monochrome system. The public site keeps its editorial identity, cream paper surfaces, and photography, while the authenticated product uses a compact dark operational workspace. Both retain the same brand voice while adapting density and interaction patterns to their context.

Dark mode remains the default for operational surfaces. The existing light-mode preference uses `data-theme` and persists in `localStorage["barracks-theme"]`.

### Color system

| Role | Value | Use |
| --- | --- | --- |
| Near black | `#0B0D0D` | Main application canvas |
| Charcoal | `#0F1111` | Sidebar and deep inset regions |
| Dark gray | `#1C1E1F` | Main operational panels and cards |
| Elevated | `#232526` | Controls, popovers, and raised surfaces |
| Hover | `#292B2C` | Interactive hover and selected depth |
| Off white | `#F2F0EA` | Primary text and monochrome actions |
| Cream | `#F3F1EB` | Public paper surfaces and light accents |
| Muted | `#B0B0AB` | Supporting copy and control labels |
| Green / amber / red | semantic tokens | Success, warning, and danger only |

Shared components should consume semantic aliases such as `--ink`, `--surface`, `--text`, `--line`, and the status tokens rather than introducing local hex values. Every status must also have a readable text label and must not rely on color alone. Internal operational modules use the shared hybrid primitives in `barracks-pwa/app/components/operations/OperationalPrimitives.tsx` for card/list toggles, filter toolbars, responsive tables, action menus, status badges, and accessible right-side detail drawers that become full-screen mobile sheets.

The inventory item drawer and the shared detail drawer use a simple two-state transition: closed at `translateX(100%)`, open at `translateX(0)`, with a matching scrim fade over 180ms. The drawer holds its populated content while sliding back out, stops accepting input as soon as closing begins, and focuses its close control without scrolling the page. `barracks-pwa/app/hooks/useDrawerPresence.ts` keeps a closing drawer mounted until the transition finishes, cancels an opening that is closed before its first frame mounts, and publishes `entering`, `entered`, and `exiting` as `data-state` on the drawer layer. Reduced-motion mode skips the drawer and scrim transitions.

### Typography

- The public hero uses the bundled Barracks lockup image for the oversized brand moment, with Sora and Inter retained for navigation, controls, and supporting editorial UI.
- `Geist` is the body and interface face for navigation, controls, descriptions, and operational content.
- `Geist Mono` is for times, prices, compact labels, metadata, and other system-like notation.
- `Inter` is the primary interface face inside the Staff, Management, and Customer dashboards, with `Sora` reserved for dashboard display headings.

Keep serif display styling out of dense tables, forms, and operational copy. Public body text should remain readable and comfortably narrow; internal text should favor scanability.

All customer-facing and operational prices use the Philippine peso symbol (`₱`).

### Layout and material

The public composition remains a paced editorial read: compact navigation, a photography-led hero, service cards, a dark barber roster, branch details, an about/contact section, and a decisive CTA/footer close. Cream and paper surfaces contrast with the dark sections while Barracks photography and the display face carry the brand.

The internal workspace uses a persistent sidebar, a compact sticky topbar, metric rows, layered panels, tables, modals, and clear action zones. Shared controls use restrained radii, quiet borders, and monochrome selection states. The shared UI primitives live in `barracks-pwa/app/components/ui/`.

### Product and accessibility principles

- Keep the next operational action obvious.
- Separate staff operations from management oversight without splitting the brand.
- Let bookings, barber availability, customers, inventory, and reporting tell one connected story as the backend grows.
- Make routine updates safe, reversible, and explicit.
- Use semantic controls, visible keyboard focus, readable contrast, clear status labels, and text alongside state colors.
- Keep dialog focus stable while controlled forms rerender, and return focus to the launching control when a modal closes.
- Keep dense booking and schedule-row time/date labels compact and on one line for quick scanning.
- Keep report period actions aligned to the date input controls, with the toolbar wrapping safely at narrow widths.
- Keep shared staff tables aligned by declaring each table's real column count (`staff-table--cols-2` through `staff-table--cols-6`), and stack each cell's primary and secondary text instead of letting them run together on one line.
- Keep page-level vertical rhythm in one place: `app-content > * + *` in `barracks-pwa/app/globals.css` spaces stacked panels and metric grids, and adjacent margins collapse into it. Do not add per-block `margin-bottom` values to fix a single page.
- Define every table grid track as `minmax(<minimum>, <fr>)`, never a bare `fr`. A bare `fr` track floors at its own min-content, which differs between the header labels and the row values, so the header and rows resolve to different column widths and drift out of alignment. Give action columns a padded pixel minimum wide enough for their controls.
- Keep row actions compact and contained: a row of inline text buttons crowds the actions column and forces the whole table wider. Give action-heavy tables such as Suppliers a minimum action track and right-align the complete group, put multi-step row actions behind one icon trigger (the shared `stockIn` icon, a carton with an arrow entering it) that opens a chooser, and reserve inline icon buttons for single-step actions (edit, history, deactivate). Choose an icon whose metaphor matches what the menu does rather than a generic overflow/more glyph.
- Preserve factual Barracks content for Davao, its branches, services, roster, contact details, and hours. Synthetic data and placeholder imagery must remain clearly replaceable.

## Architecture

The current sprint uses a hybrid path: the active sprint entities are served by Next.js Route Handlers and PostgreSQL, while the public content and older out-of-scope prototype modules still use local TypeScript data and, in some cases, browser state.

### Server-backed request path

```text
React UI
  -> app/lib/api.ts
  -> Next.js Route Handler in app/api/
  -> session lookup / role check + Zod validation
  -> server/services/
  -> server/db/pool.ts
  -> PostgreSQL
```

Client components call same-origin `/api/...` endpoints. They never connect to PostgreSQL directly. Route Handlers own HTTP parsing and response formatting; server services own database operations and business rules; schemas own input validation.

### Client-only path

```text
React UI
  -> app/data/ seed content
  -> component state or usePersistentState
  -> browser localStorage for retained prototype modules
```

The current sprint pages use the API for customers, barbers, inventory, suppliers, restocks, inventory and revenue reporting, services, bookings, staff accounts, supplier accounts, and customer sessions. Front Desk Payments loads eligible visits for checkout and transaction history; Management Transactions loads history and financial actions without checkout controls. The reference lookup supplies persisted receipt details for both checkout printing and later reprints. The landing page still consumes static marketing content from `app/data/landing.ts`. Booking creation and editing load services from PostgreSQL and store name, price, and numeric duration snapshots with an expected end time and optional notes. `app/data/services.ts` is reference data only.

### Runtime composition

`barracks-pwa/app/layout.tsx` is the root document shell. It loads Geist, Geist Mono, Libre Baskerville, Inter, and Sora, imports `app/globals.css` and the canonical `app/theme.css` layer followed by the landing, login, and booking stylesheets, bootstraps the stored theme before hydration, and defines page metadata.

`barracks-pwa/app/components/BarracksApp.tsx` is the client composition root. It:

- Tracks the active `ViewId`, pending destination, current user, search value, and toast message.
- Restores the current session through `GET /api/auth/me` when the app loads.
- Redirects unauthenticated users to login when a protected view is selected, preserving the requested destination after sign-in.
- Redirects customers to the customer area and prevents them from entering staff views.
- Redirects supplier accounts to the supplier portal and keeps them out of staff and management views.
- Chooses the Management or Front Desk shell for authenticated staff.
- Handles sign-out through `POST /api/auth/logout`.

`barracks-pwa/app/utils/routes.ts` maps active view identifiers to canonical browser paths, while `barracks-pwa/app/[...slug]/page.tsx` exposes those paths through the App Router. `barracks-pwa/app/pages/PageRouter.tsx` maps active view identifiers to feature pages. `AppShell` owns sidebar navigation, workspace context, search, profile/sign-out controls, and the internal frame. This client routing is not a substitute for server-side authorization.

## Repository structure

```text
.
├── README.md                         # Canonical product, design, system, and codebase guide
├── DEMO_README.md                    # Focused demo walkthrough and showcase accounts
├── running.md                        # Focused local setup and troubleshooting guide
├── IMPLEMENTATION_PLAN.md            # Shared operational module redesign plan
└── barracks-pwa/
    ├── app/
    │   ├── api/                      # Next.js Route Handlers
    │   │   ├── auth/                 # login, signup, logout, current-user lookup
    │   │   ├── barbers/              # barber list and CRUD
    │   │   ├── bookings/              # booking list/create/edit/status update
    │   │   ├── customers/             # staff list/create/update and customer self-service
    │   │   ├── health/                # unauthenticated health response
    │   │   ├── inventory/             # inventory list, CRUD, movements, alerts, thresholds
    │   │   ├── reports/               # management inventory and revenue reporting
    │   │   ├── restocks/              # restock requests, status, delivery, receiving
    │   │   ├── supplier/              # supplier portal self-service
    │   │   ├── suppliers/             # supplier CRUD and supplier accounts
    │   │   └── users/                 # management-role staff account APIs
    │   ├── components/
    │   │   ├── BarracksApp.tsx          # persistent client app and session hydration
    │   │   ├── bookings/              # shared booking form
    │   │   ├── customers/             # shared customer form
    │   │   ├── inventory/             # shared inventory form
    │   │   ├── layout/                # AppShell
    │   │   ├── operations/            # shared card/list/drawer operational primitives
    │   │   └── ui/                    # buttons, fields, panels, dialogs, badges, icons
    │   ├── constants/                 # navigation and role options
    │   ├── data/                      # landing content and legacy prototype seed data
    │   ├── hooks/                     # browser persistence hook for legacy modules
    │   ├── lib/                       # frontend API wrapper and response types
    │   ├── pages/                     # public, auth, customer, supplier, staff, and admin screens
    │   │   └── public/landing-motion.css # landing-page scroll motion and entrance choreography
    │   ├── types/                     # shared frontend domain types
    │   ├── utils/                     # formatting, CSV download, view helpers, and route mapping
    │   ├── globals.css                # tokens, shared styles, shell, modules, responsive rules
    │   ├── theme.css                  # canonical dashboard theme layer
    │   ├── layout.tsx                 # document shell and metadata
    │   ├── page.tsx                   # public root route
    │   ├── [...slug]/page.tsx         # validated URL-backed app routes
    │   └── favicon.ico
    ├── public/                        # logo, branch imagery, and static assets
    ├── server/
    │   ├── auth/                      # session lookup and role guards
    │   ├── db/                        # PostgreSQL pool and SQL migrations
    │   ├── schemas/                   # Zod schemas and validation formatting
    │   └── services/                  # database-facing domain and session services
    ├── scripts/                       # migration and seed commands
    ├── tests/                          # schema and PostgreSQL integration tests
    ├── package.json                    # scripts and dependencies
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── tsconfig.json
    └── .env.example                   # server-only local environment contract
```

### Active page surfaces

| Surface | Main implementation | Data path |
| --- | --- | --- |
| Public landing | `app/pages/public/LandingPage.tsx` and `app/pages/public/landing/*` | Static `app/data/landing.ts` and bundled imagery |
| Login/signup | `app/pages/auth/LoginPage.tsx` | `/api/auth/login`, `/api/auth/signup` |
| Customer dashboard/profile | `app/pages/customer/CustomerDashboard.tsx` — dashboard-style color accents for metrics and appointment state; the empty upcoming state keeps booking in the panel header instead of repeating a second button | `/api/customers/me`, `/api/bookings`, `/api/barbers` |
| Customer booking | `app/pages/customer/CustomerBookingPage.tsx` | Service catalog plus `/api/barbers` and `/api/bookings` |
| Staff dashboard | `app/pages/staff/StaffDashboard.tsx` | `/api/barbers` |
| Staff queue | `app/pages/staff/QueuePage.tsx` — active queue workflow and read-only completed-today view | `/api/queue?view=active`, `/api/queue?view=completed-today`, `/api/customers`, `/api/services`, `/api/barbers` |
| Staff bookings | `app/pages/staff/BookingsPage.tsx` — card/list schedule with appointment drawer | `/api/bookings`, `/api/customers`, `/api/barbers` |
| Staff customers | `app/pages/staff/CustomersPage.tsx` — card/list customer records, profile drawer, and CRUD | `/api/customers`, `/api/barbers` |
| Front Desk Barber Floor | `app/pages/staff/BarberFloorPage.tsx` — current availability, queue assignments, and daily status updates | `/api/barbers`, `/api/barbers/:id/status`, `/api/queue?view=active` |
| Management barbers | `app/pages/admin/BarbersManagement.tsx` — roster, profile drawer, and scheduling | `/api/barbers`, `/api/barbers/:id/schedule`, `/api/shop-hours` |
| Management inventory | `app/pages/staff/InventoryPage.tsx` — item cards/list with photo, branch, and stock state plus an item drawer | `/api/inventory` |
| Admin dashboard | `app/pages/admin/AdminDashboard.tsx` | `/api/barbers`, `/api/bookings`, `/api/customers`, `/api/inventory` |
| Admin staff accounts | `app/pages/admin/StaffManagement.tsx` — card/list access roster with lifecycle drawer | `/api/users` |
| Management suppliers | `app/pages/admin/SuppliersManagement.tsx` — card/list vendor directory with profile drawer | `/api/suppliers`, `/api/inventory`, `/api/restocks` |
| Management restocks | `app/pages/admin/RestockManagement.tsx` — workflow cards/list with request drawer | `/api/restocks`, `/api/suppliers`, `/api/inventory` |
| Admin inventory reports | `app/pages/admin/InventoryReports.tsx` — valuation, low-stock, supplier-spend, and usage summaries | `/api/reports/inventory` |
| Admin sales reports | `app/pages/admin/RevenueReports.tsx` — sales, reversals, daily totals, and service/barber/method breakdowns | `/api/reports/revenue` |
| Supplier portal | `app/pages/supplier/SupplierPortal.tsx` — profile, supplied items, open requests, delivery history, and account settings | `/api/supplier/me`, `/api/restocks`, `/api/supplier/account` |

Legacy prototype screens such as `ReportsPage` and settings pages remain available as source references but are not active destinations in the sprint view switchboard; the `/admin/reports` destination renders `ManagementReports` with sales and inventory sections. `ServicesManagement` is available at `/admin/services` to managers and administrators. `QueuePage` and the staff `PaymentPage` are active PostgreSQL-backed shop-floor destinations.

## API routes

All protected routes use the HTTP-only `barracks_session` cookie. JSON errors follow the general shape `{ success: false, message, errors? }`; validation errors include field-level messages.

### Authentication

- `POST /api/auth/login` — public. Validates credentials, verifies the scrypt password hash, creates a seven-day database session, and sets the HTTP-only cookie.
- `POST /api/auth/signup` — public. Validates customer details, creates a customer user plus linked customer record, and starts a session.
- `POST /api/auth/logout` — clears the current database session and expires the cookie.
- `GET /api/auth/me` — returns the authenticated public user or `401` when no valid session exists.
- `GET /api/health` — public, database-independent health response.

### User management

- `GET /api/users` — administrator/manager; lists public staff account records visible to the actor: administrators see administrator/manager/front-desk accounts, while managers see front-desk accounts only.
- `POST /api/users` — administrator/manager; administrators can create administrator, manager, or front-desk accounts; managers can create front-desk accounts only.
- `GET /api/users/:id` — administrator/manager; reads one visible public staff record, including verification, blocked, and active state. Managers can view front-desk accounts only.
- `PUT /api/users/:id` — administrator/manager; updates identity, email, role, and optionally resets the password. Managers can edit front-desk accounts only.
- `PATCH /api/users/:id` — administrator/manager; accepts `verify`, `unverify`, `block`, or `unblock`, revoking sessions whenever access is disabled. Managers can change lifecycle for front-desk accounts only.
- `DELETE /api/users/:id` — administrator/manager; soft-deactivates a permitted account, revokes its sessions, and keeps the database record. Managers can deactivate front-desk accounts only; administrators cannot deactivate themselves, and the last administrator cannot be disabled, blocked, unverified, or deleted.

New staff accounts start unverified and unblocked. Login rejects unverified, blocked, or deactivated accounts. Account management provides search, role/status filters, a details view, and explicit lifecycle controls; passwords are hashed and never returned.

### Customers

- `GET /api/customers` — administrator/front desk; lists customer profiles.
- `POST /api/customers` — administrator/front desk; creates a customer account/profile.
- `GET /api/customers/:id` and `PUT /api/customers/:id` — administrator/manager/front desk; read/update a customer profile. Loyalty points are administrator/manager-only; Front Desk updates are limited to contact and preference fields.
- `GET /api/customers/me` and `PUT /api/customers/me` — customer only; read/update the profile linked to the current session.

Staff customer management includes search, profile details, contact/preference editing, loyalty-point updates for managers and administrators, and Administrator-only account deactivation. Accountless walk-in records appear in the directory without account edit or deactivation actions. Deactivation returns a conflict while the customer has a confirmed, checked-in, or in-progress appointment; completed, cancelled, and no-show history remains available after deactivation. Booking writes recheck customer activity while locking the account/profile rows so a concurrent deactivation cannot leave a new active appointment hidden. The profile view is opened from the first action in each customer row and uses the same detail-modal pattern as barber profiles.

### Barbers

- `GET /api/barbers` — administrator, manager, front desk, or customer; Front Desk and customers receive only ID, name, and status, while management receives full barber records.
- `POST /api/barbers` — administrator/manager; creates a barber profile. Service totals are read-only.
- `GET /api/barbers/:id` — administrator/manager/front desk; Front Desk receives only ID, name, and status, as with the barber list.
- `PUT /api/barbers/:id` — administrator/manager; updates a barber profile.
- `PATCH /api/barbers/:id/status` — administrator/manager/front desk; accepts only `{ "status": "available" | "busy" | "unavailable" }` and updates daily operational status without profile fields.
- `PATCH /api/barbers` — administrator only; applies a validated commission rate to all barber records in one transaction.
- `DELETE /api/barbers/:id` — administrator only; deletes a barber only when no linked operational or historical record, including attendance, references the profile; otherwise returns a conflict.

### Inventory

- `GET /api/inventory` and `POST /api/inventory` — administrator/manager; list/create inventory items. Inventory rows have immutable numeric branch ownership; `GET` and `POST` accept `?branchId=...`, defaulting to the staff primary/first accessible branch.
- `GET /api/inventory/:id` and `PUT /api/inventory/:id` — administrator/manager; read/update an item.
- Inventory SKUs are unique within each branch (case-insensitive, blank SKUs excluded). Creating an item with, or editing an item onto, a SKU that is already in use returns `409` with "Another inventory item already uses this SKU" instead of a generic failure.
- `DELETE /api/inventory/:id` — administrator only; deactivates an item with movement, restock or threshold history; otherwise deletes it after confirmation in the UI.
- `GET /api/inventory/:id/movements` and `POST /api/inventory/:id/movements` — administrator/manager; list or record auditable stock movements with item branch context.
- `GET /api/inventory/:id/threshold-history` — administrator/manager; returns item/branch threshold changes with actor and timestamp.
- `GET /api/inventory/alerts` and `POST /api/inventory/alerts/:id/acknowledge` — administrator/manager; list and persist low-stock acknowledgements per user. Acknowledgements reactivate after stock rises above the branch threshold and later falls below it again.

Inventory state is derived from quantity and the branch-specific minimum stock: In Stock, Low Stock, or Out of Stock. The UI provides a branch selector, search, category/status/supplier filters, editable minimum/maximum thresholds, validation, loading/empty/error states, metrics, confirmation dialogs, stock movement recording, and movement history. Threshold changes retain the item, branch, user, and timestamp. Receiving a restock also writes an auditable `RECEIVE` movement.

### Suppliers and restocks

- `GET /api/suppliers` and `POST /api/suppliers` — administrator/manager; list/create supplier records.
- `GET /api/suppliers/:id` and `PUT /api/suppliers/:id` — administrator/manager; read and edit suppliers. Only an Administrator can deactivate an active supplier, including through `PUT` status changes or `DELETE /api/suppliers/:id`.
- `POST /api/suppliers/:id/account` — administrator only; creates or links one supplier portal account.
- `GET /api/supplier/me` — supplier only; returns the linked profile, supplied items, deliveries, and restock history.
- `PATCH /api/supplier/me` — the linked supplier can update its company name, contact person, phone, email, address, and notes; status remains staff-managed.
- `GET /api/restocks?branchId=...` — administrator/manager receive requests for the authorized selected branch; supplier accounts receive only requests for their active supplier.
- `POST /api/restocks` — administrator/manager; creates a branch-scoped request with one or more unique items linked to the selected active supplier and branch. The staff Restocks workspace supports adding, removing, and editing lines.
- `PATCH /api/restocks/:id/status` — the linked supplier advances Pending → Accepted → Preparing → Shipped.
- `POST /api/restocks/:id/delivered` — administrator/manager; confirms a shipped request as delivered.
- `POST /api/restocks/:id/receive` — administrator/manager; receives every line of a delivered request transactionally, rejects duplicate/invalid transitions, updates stock, and writes `RECEIVE` movement records with item, supplier, branch, timestamp, and responsible user.
- `GET /api/reports/inventory` — administrator/manager; returns valuation, low-stock, supplier-spend, and movement summaries.
- `GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD` — administrator/manager; returns gross sales, refunded and voided amounts, net revenue, transaction count, daily sales, and service/barber/payment-method breakdowns. The default range is the latest 30 Manila-local dates. Both endpoints use inclusive report dates.

The supplier portal is a responsive supplier-specific workspace with a split overview: a compact clickable supplier profile card sits beside linked-item, open-request, delivery, and account-status metrics. Selecting the profile card opens the shared operational detail drawer for editing supplier details, while the restock and delivery panels preview the newest records and expose full queue/archive drawers when there are more to browse. Restock request and delivery-history rows also open read-focused drawers with status, branch, timestamps, notes, and line-item context. Supplier-facing status actions remain limited to the documented request transition flow. On wider screens, the lower supplied-items panel aligns with the bottom of the combined restock and delivery-history column before returning to natural stacked heights on smaller screens.

### Bookings

- `GET /api/services` — customer, front desk, manager, or administrator; customers receive active services only.
- `GET /api/services/:id` — the same roles; customers may read active services only.
- `POST /api/services` and `PATCH /api/services/:id` — manager or administrator; validate ID, name, description, nonnegative price, positive integer duration, and active state. `PATCH` can enable or disable a service.
- `GET /api/bookings` — administrator/manager/front desk receive all bookings; customers receive only their own bookings.
- `POST /api/bookings` — front desk can select a customer; customers can create only their own booking. The request includes an optional barber ID (omit or null for Any Available Barber), service, date, server-generated time slot, and optional notes (500 characters maximum).
- `PUT /api/bookings/:id` — front desk can edit a confirmed booking's customer, barber, service, date, time, and notes; customers can edit only their own confirmed booking and cannot change its customer ownership.
- `PATCH /api/bookings/:id` — front desk can move `confirmed → checked_in → in_progress → completed`, cancel a confirmed or checked-in booking, or mark a confirmed booking no-show once its start is at least 10 minutes past. Customers may only cancel their own confirmed booking.
- `DELETE /api/bookings/:id` — Administrator-only hard deletion of a confirmed booking; other roles must use permitted lifecycle actions, preserving historical records.

Booking creation and editing validate the selected slot against shop and barber schedules, breaks, absences, existing bookings, and Philippine time. PostgreSQL exclusion constraints prevent overlapping active barber and customer intervals under concurrent requests, while allowing adjacent slots. The booking stores the service name, price, duration, and expected end time; notes are trimmed and stored as null when blank. Customers can cancel only their own confirmed bookings; Front Desk retains the daily lifecycle actions. Only administrators can permanently delete a confirmed booking. Booking-load failures have an error state and never fall through to “No bookings found.”

### Queue

- `GET /api/queue?view=active|completed-today` — administrator, manager, or front desk; defaults to active (`waiting`, `ready`, `in_progress`) and excludes booking-linked rows unless the booking is checked in or in progress with the matching queue state. Completed today contains only `completed` entries whose `completed_at` is in the current Manila-local calendar day; `removed` entries are excluded. Each record has derived `visitType`; appointment records include live booking date, time, and status. Unknown views return 400. Results keep joined-time and ID order.
- `GET /api/queue/next?barberId=...` — front desk, manager, or administrator reads the next eligible customer for an operationally available barber; returns an entry or a clear no-customer message without changing queue state. A checked-in appointment assigned to that barber has first priority. Otherwise, assigned ready walk-ins and then unassigned waiting walk-ins are considered in joined-time and ID order. Each walk-in must have an active service with a duration that fits from the current time through shop hours, shift, breaks, temporary unavailability, and active booking intervals. A longer walk-in can be skipped for a later shorter one; if none fits, the result is empty. This changes suggestions only; the visible Active Queue retains its original order.
- `POST /api/queue/next` — front desk confirms assignment of a suggested unassigned walk-in using `barberId` and `entryId`; the server rechecks current availability and the suggestion, then moves it to `ready` without starting service.
- `POST /api/queue` — front desk adds a walk-in with an existing customer or a new name/optional phone record, an active service, and an optional operationally eligible barber; the customer and queue entry are written transactionally, and an idempotency key is required for safe retries.
- `PATCH /api/queue/:id` — front desk assigns, changes, or clears a walk-in barber, starts a ready entry, or completes an in-progress entry. Assignment and start recheck operational availability; invalid transitions return a specific conflict message. Linked appointment entries can start or complete service through the booking lifecycle; booking and queue updates are transactional.
- `DELETE /api/queue/:id` — front desk marks a waiting or ready walk-in as removed. Appointment cancellation remains in the booking API.

### Barber attendance

- `GET /api/attendance/today` — Front Desk, Manager, Administrator; lists records for the current Asia/Manila date.
- `POST /api/attendance/today/:barberId` — the same staff roles; accepts `{ "action": "mark", "status": "present|late|absent" }`, `{ "action": "clock_in" }`, or `{ "action": "clock_out" }`. Clock-in and clock-out use server time. Clock-in creates a Present record when none exists and changes an Absent record to Present. Clock-out requires an open clock-in. Marking Absent after clock-in needs a management correction.
- `GET /api/attendance/history?barberId=&date=&status=` — Manager or Administrator; filters by barber ID, exact attendance date, and status, newest dates first.
- `GET /api/attendance/:id/corrections` — Manager or Administrator; returns every saved correction in reverse order.
- `POST /api/attendance/:id/corrections` — Manager or Administrator; requires status, nullable ISO clock-in/out values, and a nonblank reason. The record update and before/after correction entry commit together. Invalid clock order, clock-out without clock-in, and Absent with clock times are rejected.

All routes use server-side role guards: unauthenticated calls return `401`; disallowed roles return `403`. Front Desk cannot access historical records or correction endpoints.

### Payment foundation

- `POST /api/transactions` — front desk only; accepts `{ "visit": { "bookingId": 1 }, "paymentMethod": "cash", "amountReceived": 500 }` or a `queueEntryId` visit. Non-cash methods omit `amountReceived`. Only completed bookings and completed walk-ins qualify. The server uses the stored visit price snapshot as both subtotal and total, records the signed-in cashier, and creates one completed full-payment transaction and tender atomically. Cash below the total returns `422`; an incomplete visit or duplicate checkout returns `409`. A booking-linked queue entry must be paid by booking ID. The result includes the reference, customer, service, barber, cashier, subtotal, total, method, cash received and change when applicable, status, and timestamp.
- `GET /api/transactions?reference=TX-...` — staff lookup by exact reference.
- `GET /api/transactions?view=eligible` — front desk, manager, or administrator can view completed unpaid bookings and walk-ins with stored service prices; checkout mutation is Front Desk-only.
- `GET /api/transactions?view=history` — administrator, manager, or front desk can read paginated persisted history with `page` (default 1), `pageSize` (default 20, maximum 100), optional reference/customer `search`, `paymentMethod`, and inclusive Manila-local `dateFrom`/`dateTo` filters. The response includes `total`, `totalPages`, and each sale's current refund/void status.
- `POST /api/transactions/actions` — administrator or manager only; accepts an exact reference, `refund` or `void`, the full paid amount, and a nonblank reason. A row lock serializes competing requests. The audit action and matching sale/tender status changes commit together. Completed sales can receive one full refund or void; repeat actions, partial amounts, and over-refunds return `409`. Receipt lookup includes the dated action, amount, reason, and staff snapshot alongside unchanged original payment details.

Accepted methods are `cash`, `card`, `e_wallet`, `bank_transfer`, and `other`. The API creates a single completed tender for the full amount. It accepts only cash received from the client, never a client-supplied charge amount or status. Database checks constrain the method/status columns, and deferred integrity checks require the sole tender to match the transaction header. Phase 5 supports full refunds and voids with immutable action history. Split and partial payments require a later schema/service change.

## Database and server layer

The backend uses raw parameterized SQL through `pg`. It does not use Prisma, Drizzle, Express, Hono, or another backend framework. The same server layer works with either a local PostgreSQL database or a hosted Supabase PostgreSQL database; the active target is selected by `DATABASE_URL`, with `POSTGRES_URL` as the Vercel Supabase-integration fallback.

`server/db/pool.ts` creates the PostgreSQL pool from `DATABASE_URL` or `POSTGRES_URL`, optionally enables SSL through `DATABASE_SSL`, and uses `DATABASE_POOL_MAX` with a default of `10`. Migrations are stored in `server/db/migrations/001_user_management.sql` through `021_barber_attendance.sql`, and run transactionally by `scripts/db-migrate.ts` through the shared migration runner, which records each applied file in `schema_migrations` and skips it on later runs. Migration 014 reports any existing simultaneous active queue entries for manual reconciliation before creating the unique index. Migration 015 rejects inconsistent existing queue states for manual reconciliation. Migration 017 preflights duplicate transactions per booking and aborts with transaction IDs before changing schema or data; the migration runner rolls back any failed migration. Migration 018 backfills queue service name/price snapshots, enforces visit identity consistency, and checks that each transaction has exactly one tender matching the header. Migration 019 records cash received and change on tenders, backfills earlier cash payments as exact payments, and enforces cash balance checks. Migration 020 adds append-only financial actions and rejects direct edits or deletion of finalized sales and tenders; deferred checks require a full-amount audit action for every new refunded/voided status. Migration 021 adds unique barber/date attendance, ordered clock times, and a dedicated correction log; attendance references restrict deletion of barbers with history. Database integration tests create and drop their own temporary schemas; they require an exported database URL and schema creation privilege. `npm test` runs test files sequentially to keep disposable-schema pools within PostgreSQL connection limits; the queue concurrency test still sends simultaneous requests inside its test.

`npm test` also runs direct API authorization tests with Node's module-mock flag, checking 401/403 responses and representative allowed actions without a database. Migration 011 checks existing active barber and customer booking intervals before adding its exclusion constraints. If it finds an overlap, it reports the booking ID pairs and rolls back migration 011 without changing bookings or marking it applied. Run the read-only `barracks-pwa/scripts/booking-overlap-review.sql` against the affected database to list every pair in ID order. Staff must review the appointments, agree on an explicit time or lifecycle correction, and record that decision before rerunning `npm run db:migrate`. The application never chooses a booking to cancel automatically. Migrations 012 and 013 run after the conflict has been resolved and 011 succeeds.

Together these migrations create:

- `roles` — supported role names and descriptions.
- `users` — account identity, scrypt password hash, role, `is_verified`, `is_blocked`, optional `deleted_at`, and timestamps. Deactivated accounts remain stored but cannot sign in.
- `sessions` — SHA-256 token hash, user, expiration, and creation time.
- `barbers` — business name, availability status, commission rate, services completed, revenue, rating, and timestamps.
- `barber_attendance` — one row per barber and Manila-local date with Present/Late/Absent, server clock-in/out instants, recording/updating staff IDs, and timestamps. Its barber foreign key restricts roster deletion when history exists, and a trigger prevents deletion of recorded attendance.
- `barber_attendance_corrections` — record-specific before/after status and clock values, required reason, correcting staff ID, and timestamp. Corrections append rows and never delete prior entries.
- `customers` — registered customer profiles linked to a user, or walk-in records with a name and optional phone and no user account; preferred barber, loyalty points, and timestamps remain on the customer record.
- `inventory_items` — item name, category, quantity, minimum/maximum stock, unit, SKU, supplier link, status, unit cost, product photo, and timestamps.
- `bookings` — customer/barber relationships, service snapshot, price, date/time, status, demo key, and timestamps.
- `queue_entries` — optional unique booking link, walk-in customer/service/barber, immutable service name/price snapshots, queue status, joined/started/completed timestamps, and an optional idempotency key/fingerprint. Migration 013 links pre-existing checked-in and in-progress appointments; migration 014 permits only one `in_progress` entry per barber; migration 015 requires state-appropriate barber and timestamps, with completion no earlier than start; migration 016 supports accountless queue customers and duplicate-safe submissions; migration 018 backfills snapshots and copies booking snapshots to appointment queue entries.
- `suppliers` and `supplier_accounts` — supplier records and one linked supplier login per supplier.
- `inventory_movements` — auditable stock changes with before/after quantities, supplier, reference, and actor.
- `inventory_threshold_history` — branch-aware minimum/maximum threshold changes with the responsible user and timestamp.
- `inventory_alert_acknowledgements` — per-user persisted low-stock acknowledgement cycles that reset after replenishment.
- `restock_requests` and `restock_request_items` — supplier-linked requests, status transitions, delivery receiving, and line quantities.
- `services` — canonical service catalog with descriptions, numeric durations, prices, and active flags, referenced by bookings and transactions. Historical services with unknown durations are inactive until updated.
- `transactions` — one sale per completed booking or walk-in, with immutable visit type/ID and unique payment reference, optional live links, customer/barber/cashier/service name snapshots, amount, constrained method/status, and processing staff. Historical rows retain their original unfamiliar method/status in legacy columns while using normalized values. Snapshots survive changes or deletion of linked records.
- `transaction_payments` — one tender row linked to each transaction, including cash received and change for cash payments. Deferred database checks require the tender amount, method, and status to match its header; split tenders require a later schema/service change.
- `transaction_financial_actions` — append-only, one full refund or void per transaction, with the original transaction ID, action, amount, reason, responsible staff ID/name, and timestamp. Original sale and tender amounts, method, cash received, change, and receipt snapshots remain intact. Completed financial records cannot be deleted, so the destructive local demo reseed cannot replace an existing transaction after migration 020.

The migration is compatible with the existing Supabase project `simplecrudapp`. The Next.js server connects through the database connection string and keeps authorization in the application session/role guards; no Supabase secret or database credential is sent to the browser.

Important database constraints include case-insensitive unique user email, explicit account lifecycle columns, valid role/status/category values, non-blank names, non-negative quantities and monetary values with two-decimal precision, commission bounds, customer/user uniqueness, foreign keys, and a unique active barber slot for upcoming bookings. Inventory adds a case-insensitive unique SKU per branch (ignoring blank SKUs) and a maximum-stock check that tracks the minimum, suppliers add a case-insensitive unique active company name plus one account per supplier and per user, and restock requests enforce one line per item with a constrained status set.

`scripts/seed-admin.ts` creates the initial administrator from `INITIAL_ADMIN_*` variables and is safe to rerun for the same administrator email. `scripts/seed-demo.ts` is a local Sprint 2 seed: it runs in one transaction, preserves administrator accounts, and loads the current supplier, inventory, restock, customer, booking, and transaction showcase records. It succeeds on a fresh disposable database; a repeat run is rejected once finalized financial records exist, preserving their history. Do not run it against production data.

## Authentication, validation, and authorization

Passwords are hashed with Node's `crypto.scrypt` using a random salt. The stored format includes the algorithm parameters, salt, and derived key. Login verifies the derived key with a timing-safe comparison. Plaintext passwords are never stored or returned.

Session behavior:

- The raw random session token is sent only in the HTTP-only `barracks_session` cookie.
- Only the token's SHA-256 hash is stored in `sessions`.
- Sessions expire after seven days.
- Production cookies are `secure`, use `sameSite: lax`, and are scoped to `/`.
- Logout deletes the database session and expires the cookie.

Zod schemas live under `server/schemas/`:

- `user.schema.ts` validates login, staff account creation/update, and lifecycle actions.
- `sprint.schema.ts` validates barber, inventory, booking, customer signup, and customer profile input.
- `sprint2.schema.ts` validates supplier records, supplier accounts, inventory metadata/create/movement payloads, and restock create/status/receive payloads.

Schemas are strict, reject unknown fields, enforce bounds and enum values, and are applied before service/database work. `requireAdministrator`, `requireManagement`, `requireStaff`, `requireSupplier`, and `requireRoles` resolve the current session and return `401` or `403` responses before protected operations run. Account lifecycle changes use transactions and a PostgreSQL advisory lock to keep the last administrator rule safe under concurrent requests.

The browser does not send an admin token. Private credentials, database URLs, and seed passwords must remain server-only and must not use a `NEXT_PUBLIC_` prefix.

## Environment variables

The contract is documented in `barracks-pwa/.env.example`:

```text
DATABASE_URL
DATABASE_SSL
DATABASE_POOL_MAX
INITIAL_ADMIN_FIRST_NAME
INITIAL_ADMIN_LAST_NAME
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

The environment is intentionally portable:

| Runtime | `DATABASE_URL` | `DATABASE_SSL` | Purpose |
| --- | --- | --- | --- |
| Local | Local PostgreSQL URL ending in `/barracks` | `false` | Local development and demo data |
| Vercel | Supabase transaction-pooler URL for the Barracks database, or integration-provided `POSTGRES_URL` | `true` | Hosted frontend and API routes |

To use Supabase with an explicit connection string, apply the migrations to the Supabase database. Only run the replacement demo seed against a disposable preview/demo database, then add these server-only variables to the Vercel project:

```text
DATABASE_URL=<Supabase transaction-pooler connection string>
DATABASE_SSL=true
DATABASE_POOL_MAX=3
```

Keep `DATABASE_URL` and all `INITIAL_ADMIN_*` values out of `NEXT_PUBLIC_*` variables. The local `.env.local` and the Vercel environment variables are separate, so local PostgreSQL remains available as a fallback and for offline development.

The Next.js dev server loads `.env.local` automatically. The standalone migration and seed scripts do not, so export the file before running database commands:

```bash
set -a
source .env.local
set +a
```

Never commit `.env.local` or real credentials. Obsolete variables from the former separate-server setup—such as `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_API_TOKEN`, `ADMIN_API_TOKEN`, `CORS_ORIGIN`, and `PORT`—are not used by the current app.

## Dependencies and tooling

- Next.js `16.3.1` provides the App Router and Route Handlers.
- React `19.2.8` provides the client UI.
- TypeScript provides strict typing across app, server, and scripts.
- `pg` provides the PostgreSQL pool and queries.
- Zod provides request validation.
- `tsx` runs TypeScript database scripts.
- Tailwind's PostCSS integration is installed, but the UI is primarily authored in `app/globals.css`.

Useful commands from `barracks-pwa/`:

```bash
npm run dev
npm run lint
npm test
npx tsc --noEmit
npm run build
npm run start
git diff --check
```

For Next.js-specific changes, read the repository guidance in `barracks-pwa/AGENTS.md` and the matching installed guide under `barracks-pwa/node_modules/next/dist/docs/` before editing routing, layouts, server/client boundaries, caching, or build configuration.

## Current limitations and next steps

The sprint backend is intentionally partial. The main remaining seams are:

- Settings still needs its own rendered screen. The Payments screen supports full checkout, paginated transaction history, printer-friendly saved receipts, manager/administrator full refunds and voids, and per-transaction audit history. The active Management Reports screen offers Sales & revenue and the existing Inventory reports. Sales reports use persisted transaction amount, service name, barber name, and payment method snapshots; they never use `barbers.revenue` or current catalog values. Gross sales and transaction count use the original checkout date; full refund and void amounts use their financial-action date. Pre-Phase-5 reversed rows without an action timestamp are attributed to their transaction date. Dates and daily grouping use Manila time. Net revenue is gross sales minus both reversal types and may be negative when prior-period sales are reversed. Group names reflect the snapshots saved at checkout, so renamed services or barbers retain their historical labels. Partial refunds, split tenders, discounts, loyalty, product checkout, and gateway workflows remain unimplemented. A refund/void records the financial reversal; it does not initiate an external processor transfer.
- Existing queue rows receive the current catalog price during migration 018 because their historical walk-in prices were never stored; their original prices cannot be reconstructed. New walk-ins snapshot the service name and price when queued, and appointment queue entries copy the booking's snapshots.
- Account password reset/invitation flows, MFA, rate limiting, and audit history are not implemented. Account deactivation is a soft delete; the account row is retained and its sessions are revoked.
- Dashboard and customer/barber summaries cover the sprint entities but do not yet form a complete reporting model.
- Inventory movements and restock receiving are transactional and auditable; broader stock-use workflows and concurrency coverage remain to be expanded.
- There is no payment processor, notification delivery, calendar sync, email confirmation, rate limiting, MFA, or observability layer.
- Some inactive legacy prototypes, including payment and report references, still use seed data or `localStorage`; those paths should not be treated as production persistence.
- The repository has schema tests and PostgreSQL integration tests; run `npm test` after loading a configured database to execute the integration coverage (the database tests are skipped when no connection string is present). A browser automation test runner and visual regression suite are not configured, so the final browser smoke evidence is run manually against the local dev server.

The recommended evolution is incremental: add later tender, item, discount, and partial refund workflows, persist settings, and expand automated coverage, observability, rate limiting, and deployment documentation.

## Contribution rules

- Put reusable visual behavior in `app/components/ui` and shared workflows in `app/components/<domain>`.
- Keep shell and navigation behavior in `app/components/layout`.
- Put HTTP endpoints under `app/api` and server-only logic under `server`.
- Keep database queries out of client components and use `app/lib/api.ts` for same-origin requests.
- Add Zod schemas for new request payloads and keep business/database operations in services.
- Add a migration when the database shape changes.
- Preserve accessible labels, keyboard focus, dialog semantics, and text status cues.
- Use the existing neutral design language; do not reintroduce saturated decorative accents.
- Update this root README whenever code, configuration, dependencies, database, API, or architecture behavior changes.
- Before handoff, run TypeScript, lint, build, and diff checks, and manually verify affected UI flows at desktop and mobile widths.

### Dashboard surface finish

Staff and Management workspaces (`.app-shell`) and the Customer Dashboard (`.customer-page--dashboard`) use the Barracks precision-grooming theme from the supplied brand board. Inter is the primary interface typeface, with Sora for dashboard display headings and the explicit fallback stack `Inter, Sora, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. KPI metrics, prices, dates, timestamps, operational statistics, and table rows enable tabular lining figures (`lnum` + `tnum`) for consistent numeric alignment. Primary actions use Barracks red (`#dc2626`), information and links use cyan (`#0ea5e9`), and text uses cool white (`#e2e8f0`) over near-black (`#0b0d10`) surfaces. The dark dashboard follows a compact command-console style: a deep near-black workspace, visibly raised near-flat panels, crisp low-contrast borders, 6–7px corner radii, minimal shadows, a neutral active-navigation fill, and restrained red/cyan functional accents. The sidebar brand rail and sticky topbar share a 64px header line so their dividers align across the shell. Staff, management, and customer dashboards use a fluid staggered entrance sequence with a soft deceleration curve plus restrained card, icon, arrow, and row hover responses; reduced-motion preferences collapse these effects to an effectively instant state. Existing content, components, and page structure remain unchanged. Light mode maps the same semantic palette onto off-white surfaces; the customer booking page explicitly remaps its topbar, heading, form fields, reservation summary, and service-perks panel so no dark-only surface or low-contrast text remains. Reduced-transparency preferences remain supported.

Existing dashboard grids, workflows, and semantic status colors remain unchanged. Table rows stay flat for readability. Public landing/marketing styles are isolated in their own stylesheet modules.

The supplier portal shares the staff and management dashboard theme: the same dashboard typography, charcoal/glass panel hierarchy, 7px card treatment, red primary actions, semantic status colors, responsive spacing, and reduced-motion-safe entrance transitions. Its supplier profile, inventory, restock, delivery, and account-security workflows remain backed by the existing API routes.

## Booking foundation (Phase 1)

Migration `009_services_booking_foundation.sql` adds service descriptions and integer durations, booking duration snapshots, expected end times, optional notes, and the statuses `confirmed`, `checked_in`, `in_progress`, `completed`, `cancelled`, and `no_show`. Existing `upcoming` bookings migrate to `confirmed`; their stored service names and prices remain unchanged. Unknown historical durations remain null. The service API exposes active services to customers, all services to front desk, and service creation/editing/enablement to managers and administrators. Scheduling, availability, booking lifecycle, queue persistence, the one-active-service guard, queue state integrity, and quick accountless queue customers are implemented in migrations 010–016. Migrations 017–020 add the payment backend foundation, integrity rules, cash checkout fields, and financial action history. Bookings and queue branch scoping is implemented in migration 024, transaction ownership in migration 025, and attendance ownership in migration 026. Inventory/restock branch ownership is implemented in migration 027; branch aggregates, customer branch selection and notifications remain deferred. Payment Phase 3 connects checkout UI to the payment backend; Phase 4 adds receipt printing and filtered, paginated history without another invoice table; Phase 5 adds full refunds and voids.

### Multi-branch foundation (Phase 1)

Migration `022_multi_branch_foundation.sql` adds `branches` and `user_branches`. The current shop is `Main Branch` (`MAIN`); existing non-deleted Managers and Front Desk accounts receive a primary Main Branch assignment. Administrators remain global and have no memberships. Customers and suppliers cannot be assigned. Memberships are unique per user/branch, and a partial unique index enforces at most one primary per user. Role changes out of Manager/Front Desk and account deletion remove memberships. New staff accounts require explicit assignment; membership does not change existing operational permissions.

Backend helpers in `server/auth/branch-access.ts` list accessible branches, check/require membership, and retrieve the primary branch. Administrators can access every existing branch; Managers and Front Desk can access assigned branches. Inactive branches retain their memberships; operational status enforcement is deferred. A user may have no primary, including after removing their primary assignment. Branch identity is independent of the existing inventory branch text labels. No operational data or behavior is scoped by these tables in Phase 1.

Branch APIs use existing HTTP-only sessions and server role guards: Administrator-only `GET/POST /api/branches` (list includes eligible staff), `PATCH /api/branches/:id` (details or `status: active/inactive`), `GET/POST /api/branches/:id/assignments`, and `DELETE/PATCH /api/branches/:id/assignments/:userId` (PATCH accepts `isPrimary: true`). Duplicate codes/memberships return 409. Primary changes run in a transaction with a user-row lock. `GET /api/branch-context` is available to staff and returns only accessible branches and a nullable primary. Shared `Branch`/`BranchAssignment`/`BranchContext` types and `resolveBranchSelection` provide the minimum future selector foundation; no global selector or operational branch filtering is enabled.

Administrators have a **Branches** navigation entry at `/admin/branches`, using the existing panels, buttons, forms, and modals. They can create/edit branch details, activate/deactivate branches, view assigned staff, assign/remove eligible staff, and set a primary branch. Managers cannot see or open this page; the APIs enforce the same restriction independently.

Phase 1 verification: `tests/branch-permissions.test.ts`, `tests/branches.integration.test.ts`, `tests/branches-ui.test.tsx`, and the extended view-access tests cover API/UI permissions, persisted CRUD, migration backfill, duplicate assignment prevention, concurrent primary changes, Administrator global access, assigned staff access, and customer/supplier exclusion. Database tests use disposable schemas and need the existing database environment variables. Phase 1 added the 22nd migration; Phase 2 adds migration 023. Migration 022 must still be applied with `npm run db:migrate` to enable this feature in the shop database.

### Multi-branch barbers and scheduling (Phase 2)

Migration `023_branch_barbers_and_hours.sql` gives barbers required branch ownership and replaces global operating-hour uniqueness with `(branch_id, day_of_week)`. Existing barbers and hours belong to Main Branch; existing shifts, breaks and absences are preserved. Existing and newly created branches receive seven default days (09:00–19:30). Legacy SQL imports/demo seeds without barber ownership receive Main Branch through a database default; barber creation/editing APIs require a valid explicit `branchId`.

The existing Barber Management and Barber Floor pages use `/api/branch-context` and the Phase 1 selection helper. Administrators can select any branch; Managers and Front Desk can select assigned branches only. Switching branches reloads the roster and operating hours, clears open editor state, and ignores obsolete load responses. Barber Floor metrics reflect only the displayed roster; existing queue and attendance records/APIs remain unchanged. Managers retain barber and schedule management; Front Desk retains only operational barber visibility/status access and gains no schedule management. Barber lists accept `branchId`, and every staff barber ID read/update and schedule/absence operation checks actual barber ownership on the backend. Authorization and ID operations share a transaction and barber row lock, preventing ownership changes between the check and operation. Administrator bulk commission remains global and deletion remains Administrator-only. Managers cannot edit commission/rating fields.

`/api/shop-hours?branchId=...` reads or updates the selected branch's hours, with staff branch access enforced on the backend and management required for updates. Customer hours retain Main Branch behavior and customer selection remains deferred. New barber schedules copy only their owning branch's seven days. Working shifts must fit that branch's hours. Changing hours preserves existing shifts; availability intersects the shift with the barber's branch hours. Shared availability helpers resolve barber → branch → hours, including Any Available Barber calculations. Each availability calculation caches hours by branch, avoiding repeated reads for barbers sharing a branch.

Barber moves require access to both source and destination. The database rejects a move while confirmed/checked-in/in-progress bookings or waiting/ready/in-progress queue entries remain, or when existing working shifts do not fit the destination hours. Accepted moves preserve shifts, breaks and absences, and historical references. Phase 2 adds no branch columns or branch filtering to bookings, queue entries, transactions/payments, attendance, inventory, restocks, reports, customer booking flow, or aggregate dashboards. Apply migration 023 through the existing migration runner before using Phase 2; verification uses disposable test schemas and does not migrate the real shop database.

Phase 2 verification: 33 focused tests pass; the full suite finishes with 117 passing and one pre-existing attendance assertion failure (`23503` expected versus `23001` returned), reproduced on unchanged Phase 1 code. TypeScript (`npx tsc --noEmit`), ESLint and production build pass. New disposable-schema API/migration tests cover ownership backfill, branch-specific defaults, assigned staff access and ID/parameter bypass attempts, Administrator access, schedule copying, both availability helpers, and rejected/successful moves. DOM tests cover branch switching on existing management and floor pages. See [PHASE2_REPORT.md](PHASE2_REPORT.md) for the complete file list and handoff details.

### Multi-branch bookings and queue (Phase 3)

Migration `024_booking_queue_branches.sql` adds required branch foreign keys and branch/date or branch/status/FIFO indexes to bookings and queue entries. Every existing record is backfilled to Main Branch without changing snapshots, lifecycle states or history. Legacy SQL imports default to Main Branch. Visit ownership stays fixed; database triggers serialize barber assignment against barber moves and reject cross-branch assignments. Historical barber references remain valid after permitted moves.

Bookings and Queue now have staff branch selectors using the existing branch context. Switching branches remounts their workspace, clears editors/suggestions, and reloads scoped bookings, active/completed queue and barber choices. Barber Floor queue reads use its selected branch. APIs accept `?branchId=...` for collections, booking creation, walk-ins, availability and next-customer suggestions/confirmation. Missing selection resolves the staff primary/first accessible branch. Managers and Front Desk may access assigned branches only; Administrators may select any branch. ID mutations authorize the record's persisted ownership, preserving existing role/action permissions. Front Desk retains operations; management access remains read-only except existing Administrator deletion.

New bookings store the authorized branch, edits retain it, and check-in creates an appointment queue entry with the booking's branch. Walk-ins store their authorized branch; next-customer selection scans only that branch while retaining appointment/ready priority, FIFO, availability checks, locking, idempotency and lifecycle constraints. Availability and Any Available Barber consider only the selected branch and use Phase 2 operating hours and schedules. Customer booking creation, availability and barber choices stay on Main Branch with no branch selector.

Phase 3 deferred payment/transaction ownership, attendance ownership, inventory/restock branch support and branch reports/dashboard aggregates. Payment/transaction ownership is implemented by Phase 4 below. Apply migration 024 with the existing migration runner before using this phase; implementation verification uses disposable schemas and does not migrate the shop database.

### Multi-branch transactions and payments (Phase 4)

Migration `025_transaction_branches.sql` adds required branch ownership to `transactions`, a restricted branch foreign key, and a branch/creation-time index for payment history. Existing sales are backfilled to Main Branch without changing receipt snapshots, tenders, timestamps, refund/void status or financial audit entries. Inside the migration runner's transaction, the migration temporarily disables the finalized transaction guard and transaction/action consistency trigger for the branch-only backfill, drains the remaining deferred checks, and restores both guards before commit. This preserves older reversed payments that predate the audit table without fabricating audit entries. If an existing transaction already references a non-Main visit, migration stops with its transaction IDs for review rather than assigning conflicting ownership or rewriting financial history.

New checkout stores the locked booking or walk-in queue entry's branch; client branch input never determines sale ownership. Database triggers reject disagreement with linked bookings/queue entries and prevent ownership changes. Nullable visit links may still clear under existing foreign-key deletion behavior while the financial record retains its branch. `transaction_payments` and `transaction_financial_actions` inherit branch ownership through their required transaction links, so no duplicate branch fields are added to tenders or audit entries.

The payment implementation actually present on this branch includes cash/non-cash checkout, saved receipts, paginated history and full refunds/voids. Phase 4 scopes these existing features without adding payment functionality. Checkout and financial actions check the actor's persisted role and branch membership inside their existing transaction. Managers/Front Desk can process only assigned branches within their existing role permissions; checkout API/UI remains Front Desk, and refund/void API/UI remains management. Administrators retain global financial access. Transaction GET accepts `branchId` for eligible visits, history and saved receipt lookup. With no branch filter, Administrators see global history and assigned staff see only their accessible branches. Unauthorized reference lookups return 404; explicitly requesting an unauthorized branch returns 403.

The existing payment screen uses branch context and remounts its workspace on selection changes, clearing old checkout drafts, receipts and financial-action forms. Eligible visits, paginated history and receipt reads follow the selected branch. Phase 4 defers attendance to Phase 5 below; inventory/restock branch ownership, branch report/dashboard aggregates and customer branch selection remain deferred. Apply migration 025 before using Phase 4; automated database verification uses disposable schemas, not the shop database.

Phase 4 verification and the complete file list are recorded in [PHASE4_REPORT.md](PHASE4_REPORT.md), including the once-only full suite result and focused verification of the legacy financial-history migration repair.

### Multi-branch attendance (Phase 5)

Migration `026_attendance_branches.sql` adds required attendance branch ownership, a restricted branch FK and a branch/date/barber index. All legacy attendance is backfilled to Main Branch, including records whose barber has since moved. Legacy records contain no branch-at-creation or barber-move history, so their original branch cannot always be reconstructed; Main Branch is the agreed historical fallback. Existing attendance values, timestamps and correction entries are preserved.

New records snapshot the barber's current branch on the server and in an insert trigger. Client ownership is rejected, and staff creation requires access to that branch. Stored branch and barber ownership are immutable. There is deliberately no constraint tying historical attendance to the barber's current branch: a subsequent move leaves attendance and correction history under the original branch. Daily updates and management corrections authorize the stored branch and do not rewrite ownership. One record per barber per Manila calendar day, existing clock rules, append-only corrections and the barber-no-login design remain unchanged. A same-day move does not create a second attendance record in the destination branch.

Today's attendance, history and correction reads are scoped to accessible branches, with optional `branchId` narrowing. Administrators have global access; Managers and Front Desk are assigned-only. Existing role permissions are retained: Front Desk uses daily attendance on Barber Floor, while management reviews history and corrections. Explicit unauthorized branch requests return 403; unauthorized correction lookups return an empty list. Writes check persisted staff authorization inside the transaction.

Attendance Management uses the existing branch context and resets its records, filters and correction dialog when branches change. Barber Floor reads and updates today's attendance for its selected branch. Historical filters include barbers represented in the loaded records even after they move. Apply migration 026 with the existing migration runner before using Phase 5. Verification uses disposable schemas and does not migrate the shop database.

Phase 5 verification and the complete file list are recorded in [PHASE5_REPORT.md](PHASE5_REPORT.md). Phase 6 inventory/restock ownership is described below. Phase 7 scope remains branch reports/dashboard aggregates and customer branch selection.


### Multi-branch inventory and restocks (Phase 6)

Migration `027_inventory_restock_branches.sql` adds required, restricted branch foreign keys to inventory stock rows, inventory movements and restock headers. Legacy labels matching exactly one existing branch name/code are mapped to it; unknown/ambiguous ownership falls back to Main Branch. Existing records, quantities, timestamps and text snapshots are preserved. Stock ownership cannot change: the same product/SKU can have a separate stock row in each branch, and SKU uniqueness is now case-insensitive within a branch. No transfers are introduced.

New movements snapshot the persisted item's branch, including CUSTOMER_PURCHASE, and cannot change ownership. Restock lines inherit their immutable header branch without another branch column; the database rejects new cross-branch lines. Receiving locks the request and stock, validates every line and changes only the request branch's inventory. Suppliers and supplier accounts remain global; the supplier portal continues to see only its linked supplier's items and requests across branches.

Inventory/restock collection APIs use `?branchId=...` and default to the staff primary/first accessible branch. ID operations authorize persisted ownership and reject a mismatched selected branch. Existing role permissions remain: Administrator/Manager operate inventory/restocks, only Administrator deletes inventory, and Front Desk has no inventory permission. Inventory, movement/threshold history, low-stock alerts and receiving enforce branch authorization. Inventory and Restock pages use the existing context, reload on selection, discard forms/dialogs/selections and ignore responses from the old workspace. Existing inventory report reads are restricted to authorized ownership; new branch report/dashboard aggregates are deferred.

Apply migration 027 using `npm run db:migrate` before using Phase 6. Tests use disposable PostgreSQL schemas and do not migrate the shop database. Phase 7 remains branch revenue/report and dashboard aggregates plus customer-facing branch selection; inventory transfers remain deferred.

Phase 6 verification and the complete file list are recorded in [PHASE6_REPORT.md](PHASE6_REPORT.md).
