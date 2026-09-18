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

The full setup sequence is in [running.md](running.md). The demo seed replaces local business/demo records while preserving administrator accounts, then creates a complete Sprint 2 showcase dataset for barbers, suppliers, supplier accounts, linked inventory, restocks, receiving history, customers, bookings, and a transaction.

Demo credentials:

- Front Desk: `demo.frontdesk@barracks.local` / `frontdesk123`
- Customer: `demo.customer.ana@barracks.local` / `customer123`

## Product and sprint scope

Barracks connects the daily rhythm of a barbershop—bookings, barber availability, customers, inventory, and management oversight—inside one shared product. Staff need fast scanning and low-friction updates on the shop floor; administrators need a wider business view; customers need a simple account and booking path.

The active `sprint-1` experience includes:

- Public landing page with Barracks branding, service information, branches, contact details, and login/customer-account actions.
- Customer signup, login, profile details, preferred barber, loyalty points, booking, and appointment history.
- Staff workspace with a live barber overview dashboard, bookings, customers, barbers, and inventory.
- Management workspace with dashboard counts, staff account management, barber management, and inventory.
- PostgreSQL-backed CRUD for user accounts, barber employee profiles, and inventory, plus database-backed booking creation/editing/status updates.
- Role-aware workspace switching between Management and Shop floor.

The app uses URL-backed Next.js routes for the active surfaces. The browser restores the requested page after refresh, and protected routes rehydrate the current account from the HTTP-only session cookie before rendering the workspace.

Queue management, payments, transactions, service management, reports, calendar sync, notifications, email confirmations, and complete visit history remain outside the active sprint backend. Older prototype page components and seed collections for those areas remain in the repository as reference material, but they are not rendered by the current `PageRouter`.

### Roles and access

There are five account roles:

- `administrator`: can enter Management and Shop floor, manage staff accounts, and access all sprint data.
- `manager`: can enter Management and Shop floor and manage day-to-day business operations, including customers, barbers, suppliers, inventory, restocks, reports, and bookings. Staff account administration remains administrator-only.
- `front_desk`: works in Shop floor and can manage customers, barbers, bookings, and inventory. It can create/read/update inventory and barber records, but barber commission rates and ratings are administrator-only. It cannot enter Management, manage user accounts, or delete inventory/barber records.
- `customer`: can access only their own customer dashboard/profile and booking flow.
- `supplier`: can access the supplier portal for the linked supplier account and its restock requests.

Barbers are business records, not login identities. They do not have accounts or sessions. The migration reassigns legacy `barber` user rows to `front_desk` and removes the obsolete role.

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

Shared components should consume semantic aliases such as `--ink`, `--surface`, `--text`, `--line`, and the status tokens rather than introducing local hex values. Every status must also have a readable text label and must not rely on color alone.

### Typography

- `Libre Baskerville` is the display face for public editorial headings and meaningful identity moments.
- `Geist` is the body and interface face for navigation, controls, descriptions, and operational content.
- `Geist Mono` is for times, prices, compact labels, metadata, and other system-like notation.

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

The current sprint pages use the API for customers, barbers, inventory, bookings, staff accounts, and customer sessions. The landing page still consumes static content from `app/data/landing.ts`, and booking creation uses the small service catalog in `app/data/services.ts` to resolve a service snapshot.

### Runtime composition

`barracks-pwa/app/layout.tsx` is the root document shell. It loads Geist, Geist Mono, and Libre Baskerville, imports `app/globals.css` followed by the canonical `app/theme.css` layer, bootstraps the stored theme before hydration, and defines page metadata.

`barracks-pwa/app/components/BarracksApp.tsx` is the client composition root. It:

- Tracks the active `ViewId`, pending destination, current user, search value, and toast message.
- Restores the current session through `GET /api/auth/me` when the app loads.
- Redirects unauthenticated users to login when a protected view is selected, preserving the requested destination after sign-in.
- Redirects customers to the customer area and prevents them from entering staff views.
- Chooses the Management or Shop floor shell for authenticated staff.
- Handles sign-out through `POST /api/auth/logout`.

`barracks-pwa/app/utils/routes.ts` maps active view identifiers to canonical browser paths, while `barracks-pwa/app/[...slug]/page.tsx` exposes those paths through the App Router. `barracks-pwa/app/pages/PageRouter.tsx` maps active view identifiers to feature pages. `AppShell` owns sidebar navigation, workspace context, search, profile/sign-out controls, and the internal frame. This client routing is not a substitute for server-side authorization.

## Repository structure

```text
.
├── README.md                         # Canonical product, design, system, and codebase guide
├── DEMO_README.md                    # Focused demo walkthrough and showcase accounts
├── running.md                        # Focused local setup and troubleshooting guide
└── barracks-pwa/
    ├── app/
    │   ├── api/                      # Next.js Route Handlers
    │   │   ├── auth/                 # login, signup, logout, current-user lookup
    │   │   ├── barbers/              # barber list and CRUD
    │   │   ├── bookings/              # booking list/create/edit/status update
    │   │   ├── customers/             # staff list/create/update and customer self-service
    │   │   ├── health/                # unauthenticated health response
    │   │   ├── inventory/             # inventory list and CRUD
    │   │   └── users/                 # administrator-only staff account APIs
    │   ├── components/
    │   │   ├── BarracksApp.tsx          # persistent client app and session hydration
    │   │   ├── bookings/              # shared booking form
    │   │   ├── customers/             # shared customer form
    │   │   ├── inventory/             # shared inventory form
    │   │   ├── layout/                # AppShell
    │   │   └── ui/                    # buttons, fields, panels, dialogs, badges, icons
    │   ├── constants/                 # navigation and role options
    │   ├── data/                      # landing content and legacy prototype seed data
    │   ├── hooks/                     # browser persistence hook for legacy modules
    │   ├── lib/                       # frontend API wrapper and response types
    │   ├── pages/                     # public, auth, customer, staff, and admin screens
    │   ├── types/                     # shared frontend domain types
    │   ├── utils/                     # formatting, CSV download, view helpers, and route mapping
    │   ├── globals.css                # tokens, shared styles, shell, modules, responsive rules
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
| Staff bookings | `app/pages/staff/BookingsPage.tsx` | `/api/bookings`, `/api/customers`, `/api/barbers` |
| Staff customers | `app/pages/staff/CustomersPage.tsx` — customer records, profile details, and CRUD | `/api/customers`, `/api/barbers` |
| Staff/admin barbers | `app/pages/admin/BarbersManagement.tsx` | `/api/barbers` |
| Staff/admin inventory | `app/pages/staff/InventoryPage.tsx` | `/api/inventory` |
| Admin dashboard | `app/pages/admin/AdminDashboard.tsx` | `/api/barbers`, `/api/bookings`, `/api/customers`, `/api/inventory` |
| Admin staff accounts | `app/pages/admin/StaffManagement.tsx` | `/api/users` |

Legacy prototype screens such as `QueuePage`, `PaymentPage`, `ReportsPage`, `ServicesManagement`, and settings pages remain available as source references but are not active destinations in the sprint view switchboard.

## API routes

All protected routes use the HTTP-only `barracks_session` cookie. JSON errors follow the general shape `{ success: false, message, errors? }`; validation errors include field-level messages.

### Authentication

- `POST /api/auth/login` — public. Validates credentials, verifies the scrypt password hash, creates a seven-day database session, and sets the HTTP-only cookie.
- `POST /api/auth/signup` — public. Validates customer details, creates a customer user plus linked customer record, and starts a session.
- `POST /api/auth/logout` — clears the current database session and expires the cookie.
- `GET /api/auth/me` — returns the authenticated public user or `401` when no valid session exists.
- `GET /api/health` — public, database-independent health response.

### User management

- `GET /api/users` — administrator only; lists public administrator/manager/front-desk account records.
- `POST /api/users` — administrator only; creates an administrator, manager, or front-desk account.
- `GET /api/users/:id` — administrator only; reads one public user record, including verification, blocked, and active state.
- `PUT /api/users/:id` — administrator only; updates identity, email, role, and optionally resets the password.
- `PATCH /api/users/:id` — administrator only; accepts `verify`, `unverify`, `block`, or `unblock`, revoking sessions whenever access is disabled.
- `DELETE /api/users/:id` — administrator only; soft-deactivates the account, revokes its sessions, and keeps the database record. The last administrator cannot be disabled, blocked, unverified, or deleted.

New staff accounts start unverified and unblocked. Login rejects unverified, blocked, or deactivated accounts. Account management provides search, role/status filters, a details view, and explicit lifecycle controls; passwords are hashed and never returned.

### Customers

- `GET /api/customers` — administrator/front desk; lists customer profiles.
- `POST /api/customers` — administrator/front desk; creates a customer account/profile.
- `GET /api/customers/:id` and `PUT /api/customers/:id` — administrator/manager/front desk; read/update a customer profile. Loyalty points are administrator/manager-only; Front Desk updates are limited to contact and preference fields.
- `GET /api/customers/me` and `PUT /api/customers/me` — customer only; read/update the profile linked to the current session.

Staff customer management includes search, profile details, contact/preference editing, loyalty-point updates for administrators, and account deactivation. The profile view is opened from the first action in each customer row and uses the same detail-modal pattern as barber profiles.

### Barbers

- `GET /api/barbers` — administrator, manager, front desk, or customer; lists barber business records.
- `POST /api/barbers` — administrator/manager/front desk; creates a barber. Commission rates and ratings are administrator/manager-only, and service totals are read-only.
- `GET /api/barbers/:id` and `PUT /api/barbers/:id` — administrator/manager/front desk; read/update a barber. Front Desk updates are limited to name and status; commission rates, ratings, and service totals are protected.
- `PATCH /api/barbers` — administrator only; applies a validated commission rate to all barber records in one transaction.
- `DELETE /api/barbers/:id` — administrator only; deletes a barber only when no booking references the profile, otherwise returns an explanatory conflict.

### Inventory

- `GET /api/inventory` and `POST /api/inventory` — administrator/manager/front desk; list/create inventory items. Inventory rows carry an editable branch (default `Main Branch`); `GET` accepts an optional `branch` query filter.
- `GET /api/inventory/:id` and `PUT /api/inventory/:id` — administrator/manager/front desk; read/update an item.
- `DELETE /api/inventory/:id` — administrator only; deletes an item after confirmation in the UI.
- `GET /api/inventory/:id/movements` and `POST /api/inventory/:id/movements` — staff; list or record auditable stock movements with item branch context.
- `GET /api/inventory/:id/threshold-history` — staff; returns item/branch threshold changes with actor and timestamp.
- `GET /api/inventory/alerts` and `POST /api/inventory/alerts/:id/acknowledge` — staff; list and persist low-stock acknowledgements per user. Acknowledgements reactivate after stock rises above the branch threshold and later falls below it again.

Inventory state is derived from quantity and the branch-specific minimum stock: In Stock, Low Stock, or Out of Stock. The UI provides search, branch/category/status/supplier filters, editable branch and minimum/maximum thresholds, validation, loading/empty/error states, metrics, confirmation dialogs, stock movement recording, and movement history. Threshold changes retain the item, branch, user, and timestamp. Receiving a restock also writes an auditable `RECEIVE` movement.

### Suppliers and restocks

- `GET /api/suppliers` and `POST /api/suppliers` — administrator/manager/front desk; list/create supplier records.
- `GET /api/suppliers/:id`, `PUT /api/suppliers/:id`, and `DELETE /api/suppliers/:id` — administrator/manager/front desk; read, edit, and deactivate suppliers.
- `POST /api/suppliers/:id/account` — administrator only; creates or links one supplier portal account.
- `GET /api/supplier/me` — supplier only; returns the linked profile, supplied items, deliveries, and restock history.
- `GET /api/restocks` — administrator/manager/front desk receive staff-visible requests; supplier accounts receive only requests for their active supplier.
- `POST /api/restocks` — administrator/manager/front desk; creates a branch-scoped request with one or more unique items linked to the selected active supplier and branch. The staff Restocks workspace supports adding, removing, and editing lines.
- `PATCH /api/restocks/:id/status` — the linked supplier advances Pending → Accepted → Preparing → Shipped.
- `POST /api/restocks/:id/delivered` — administrator/manager/front desk; confirms a shipped request as delivered.
- `POST /api/restocks/:id/receive` — administrator/manager/front desk; receives every line of a delivered request transactionally, rejects duplicate/invalid transitions, updates stock, and writes `RECEIVE` movement records with item, supplier, branch, timestamp, and responsible user.
- `GET /api/reports/inventory` — administrator/manager; returns valuation, low-stock, supplier-spend, and movement summaries.

The supplier portal is a responsive supplier-specific workspace with a split overview: the supplier profile occupies the left half while linked items, open requests, deliveries, and account status form a 2×2 summary grid on the right. Supplier-facing status actions remain limited to the documented request transition flow. On wider screens, the lower supplied-items panel aligns with the bottom of the combined restock and delivery-history column before returning to natural stacked heights on smaller screens.

### Bookings

- `GET /api/bookings` — administrator/manager/front desk receive all bookings; customers receive only their own bookings.
- `POST /api/bookings` — administrator/manager/front desk can select a customer; customers can create only their own booking. The request includes barber, service, date, and time.
- `PUT /api/bookings/:id` — administrator/manager/front desk can edit an upcoming booking's customer, barber, service, date, and time.
- `PATCH /api/bookings/:id` — administrator/manager/front desk can mark an upcoming booking `completed` or `cancelled`; completed and cancelled bookings are terminal in Sprint 1.
- `DELETE /api/bookings/:id` — administrator/manager/front desk can delete an upcoming booking after confirmation. Completed and cancelled historical bookings are retained and return a conflict.

Booking creation and editing validate the date/time, confirm that the customer and barber exist, resolve the service from the local catalog, and prevent an active duplicate barber/date/time slot with a database constraint. Staff booking cancellation and upcoming-booking deletion use separate explicit confirmation steps. Booking-load failures have an error state and never fall through to “No bookings found.”

## Database and server layer

The backend uses raw parameterized SQL through `pg`. It does not use Prisma, Drizzle, Express, Hono, or another backend framework. The same server layer works with either a local PostgreSQL database or a hosted Supabase PostgreSQL database; the active target is selected by `DATABASE_URL`, with `POSTGRES_URL` as the Vercel Supabase-integration fallback.

`server/db/pool.ts` creates the PostgreSQL pool from `DATABASE_URL` or `POSTGRES_URL`, optionally enables SSL through `DATABASE_SSL`, and uses `DATABASE_POOL_MAX` with a default of `10`. Migrations are stored in `server/db/migrations/001_user_management.sql` through `005_manager_role.sql`, and run transactionally by `scripts/db-migrate.ts`.

The current migration creates:

- `roles` — supported role names and descriptions.
- `users` — account identity, scrypt password hash, role, `is_verified`, `is_blocked`, optional `deleted_at`, and timestamps. Deactivated accounts remain stored but cannot sign in.
- `sessions` — SHA-256 token hash, user, expiration, and creation time.
- `barbers` — business name, availability status, commission rate, services completed, revenue, rating, and timestamps.
- `customers` — one profile per customer user, phone, preferred barber, loyalty points, and timestamps.
- `inventory_items` — item name, category, quantity, minimum/maximum stock, unit, SKU, supplier link, status, unit cost, and timestamps.
- `bookings` — customer/barber relationships, service snapshot, price, date/time, status, demo key, and timestamps.
- `suppliers` and `supplier_accounts` — supplier records and one linked supplier login per supplier.
- `inventory_movements` — auditable stock changes with before/after quantities, supplier, reference, and actor.
- `inventory_threshold_history` — branch-aware minimum/maximum threshold changes with the responsible user and timestamp.
- `inventory_alert_acknowledgements` — per-user persisted low-stock acknowledgement cycles that reset after replenishment.
- `restock_requests` and `restock_request_items` — supplier-linked requests, status transitions, delivery receiving, and line quantities.
- `services` — canonical service catalog referenced by bookings and transactions.
- `transactions` — persisted transaction records linked to customers, bookings, barbers, and services.

The migration is compatible with the existing Supabase project `simplecrudapp`. The Next.js server connects through the database connection string and keeps authorization in the application session/role guards; no Supabase secret or database credential is sent to the browser.

Important database constraints include case-insensitive unique user email, explicit account lifecycle columns, valid role/status/category values, non-blank names, non-negative quantities and monetary values with two-decimal precision, commission bounds, customer/user uniqueness, foreign keys, and a unique active barber slot for upcoming bookings.

`scripts/seed-admin.ts` creates the initial administrator from `INITIAL_ADMIN_*` variables and is safe to rerun for the same administrator email. `scripts/seed-demo.ts` is the local Sprint 2 replacement seed: it runs in one transaction, preserves administrator accounts, removes existing local business/demo records, and loads the current supplier, inventory, restock, customer, booking, and transaction showcase records. Rerunning it is deterministic but intentionally destructive to non-administrator local data; do not run it against production data.

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

Schemas are strict, reject unknown fields, enforce bounds and enum values, and are applied before service/database work. `requireAdministrator`, `requireStaff`, and `requireRoles` resolve the current session and return `401` or `403` responses before protected operations run. Account lifecycle changes use transactions and a PostgreSQL advisory lock to keep the last administrator rule safe under concurrent requests.

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

- Out-of-scope modules such as queue, payments, services, reports, and settings still need their own rendered screens and backend workflows.
- The API does not yet cover queue, payments, settings, or complete visit history. Transaction persistence exists for the Sprint 2 relational foundation, while the older payment/report screens still need to be connected to it.
- Account password reset/invitation flows, MFA, rate limiting, and audit history are not implemented. Account deactivation is a soft delete; the account row is retained and its sessions are revoked.
- Dashboard and customer/barber summaries cover the sprint entities but do not yet form a complete reporting model.
- Inventory movements and restock receiving are transactional and auditable; broader stock-use workflows and concurrency coverage remain to be expanded.
- There is no payment processor, notification delivery, calendar sync, email confirmation, rate limiting, MFA, or observability layer.
- Some legacy prototype modules, including queue, payment, service-management, and report references, still use seed data or `localStorage`; those paths should not be treated as production persistence.
- The repository has schema tests and PostgreSQL integration tests; run `npm test` after loading a configured database to execute the integration coverage (the database tests are skipped when no connection string is present). A browser automation test runner and visual regression suite are not configured, so the final browser smoke evidence is run manually against the local dev server.

The recommended evolution is incremental: add URL-backed routes, expand authenticated server boundaries, make each domain use one canonical repository/query path, add inventory movements and booking/payment integrity rules, persist settings, then add automated coverage, observability, audit logging, rate limiting, and deployment documentation.

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

Staff and Management workspaces (`.app-shell`) and the Customer Dashboard (`.customer-page--dashboard`) use the Barracks precision-grooming theme from the supplied brand board. Inter is the primary interface typeface, with Sora for dashboard display headings and the explicit fallback stack `Inter, Sora, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. KPI metrics, prices, dates, timestamps, operational statistics, and table rows enable tabular lining figures (`lnum` + `tnum`) for consistent numeric alignment. Primary actions use Barracks red (`#dc2626`), information and links use cyan (`#0ea5e9`), and text uses cool white (`#e2e8f0`) over near-black (`#0b0d10`) surfaces. The dark dashboard follows a compact command-console style: a deep near-black workspace, visibly raised near-flat panels, crisp low-contrast borders, 6–7px corner radii, minimal shadows, a neutral active-navigation fill, and restrained red/cyan functional accents. The sidebar brand rail and sticky topbar share a 64px header line so their dividers align across the shell. Staff, management, and customer dashboards use a fluid staggered entrance sequence with a soft deceleration curve plus restrained card, icon, arrow, and row hover responses; reduced-motion preferences collapse these effects to an effectively instant state. Existing content, components, and page structure remain unchanged. Light mode maps the same semantic palette onto off-white surfaces. Reduced-transparency preferences remain supported.

Existing dashboard grids, workflows, and semantic status colors remain unchanged. Table rows stay flat for readability. Public landing/marketing styles are isolated in their own stylesheet modules.
