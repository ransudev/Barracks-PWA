# Barracks System Overview

Barracks Barbers & Shaves is a Next.js App Router PWA prototype in `barracks-pwa/`. It uses the existing React/TypeScript UI, PostgreSQL through `pg`, Zod validation, and a cookie-backed session system.

## Run locally

From `barracks-pwa/`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For database-backed work, provide the variables described in `barracks-pwa/.env.example`, then run:

```bash
npm run db:migrate
npm run db:seed-admin
npm run db:seed-demo
```

`db:seed-demo` is safe to rerun and populates the sprint views with clearly marked local demo records: four barbers, six inventory items, four customers, two bookings, and one Front Desk account. It resets only those demo records when rerun.

Demo logins:

- Front Desk: `demo.frontdesk@barracks.local` / `frontdesk123`
- Customer: `demo.customer.ana@barracks.local` / `customer123`

## Architecture

```text
React UI
  -> app/lib/api.ts
  -> Next.js Route Handler in app/api/
  -> session / role check + Zod validation
  -> server/services/
  -> server/db/pool.ts
  -> PostgreSQL
```

- `app/` contains the App Router entry point, client-driven view router, UI components, and feature screens.
- `app/api/` contains Next.js Route Handlers. Client code uses same-origin `/api/...` requests.
- `server/auth/` resolves the HTTP-only `barracks_session` cookie and applies role checks.
- `server/schemas/` contains Zod schemas and field-level validation formatting.
- `server/services/` contains database and password/session logic.
- `server/db/migrations/001_user_management.sql` creates the roles, users, sessions, barbers, customers, and inventory tables.
- `app/data/` still contains legacy sample data used by out-of-scope prototype screens. Sprint-scoped customer, barber, and inventory screens use PostgreSQL instead.

## Current sprint scope

The home view switches between the seven requested surfaces without introducing URL routing for each view:

- Landing page: public marketing page with Login and customer-account actions.
- Admin dashboard: database-backed counts and links for the sprint records.
- Unified barber dashboard: administrator/front-desk live roster overview with selectable barber business profile details and performance metrics.
- Unified customer account: one authenticated dashboard combines profile details, preferred barber, loyalty points, appointment booking, and appointment history.
- Booking system: customers can book a service, barber, date, and time; staff can view bookings and mark them completed or cancelled.
- Item profile/inventory: PostgreSQL-backed item CRUD with In Stock, Low Stock, and Out of Stock states.

The existing App Router and `PageRouter` patterns remain in place. Queue, payments, transactions, reports, service management, and real visit history remain outside this sprint.

## Roles and access

The only account roles are:

- `administrator`: admin dashboard, staff/front-desk account management, customer management, barber management, inventory management, and all scoped data.
- `front_desk`: customer, barber, inventory, and barber-dashboard operations in the Shop floor workspace. It cannot see or enter the Management workspace, and it cannot create or manage user accounts.
- `customer`: login/signup, own customer account dashboard, and own booking flow only.

Barbers are business records, not users. They do not have accounts or sessions. Existing prototype `barber` user rows are reassigned to `front_desk` when the migration is run, then the obsolete role is removed.

## API routes

Authentication:

- `POST /api/auth/login` validates credentials, verifies the scrypt password hash, creates a session, and sets the HTTP-only cookie.
- `POST /api/auth/signup` creates a `customer` user plus linked customer record and starts a session.
- `POST /api/auth/logout` deletes the current session and expires the cookie.
- `GET /api/auth/me` returns the current public user.

User management:

- `GET /api/users` lists administrator and front-desk accounts for administrators only.
- `POST /api/users` creates administrator or front-desk accounts for administrators only.
- `GET /api/users/:id` reads one user for administrators only.

Customers:

- `GET /api/customers` lists customer records for administrators/front desk.
- `POST /api/customers` creates a customer account/profile for administrators/front desk.
- `GET /api/customers/:id` and `PUT /api/customers/:id` read/update a customer for administrators/front desk.
- `GET /api/customers/me` and `PUT /api/customers/me` read/update only the authenticated customer's own record.

Barbers:

- `GET /api/barbers` and `POST /api/barbers` list/create barber business records for administrators/front desk.
- `GET /api/barbers/:id`, `PUT /api/barbers/:id`, and `DELETE /api/barbers/:id` read/update/delete barber records for administrators/front desk.

Inventory:

- `GET /api/inventory` and `POST /api/inventory` list/create inventory items for administrators/front desk.
- `GET /api/inventory/:id`, `PUT /api/inventory/:id`, and `DELETE /api/inventory/:id` read/update/delete inventory items for administrators/front desk.

Bookings:

- `GET /api/bookings` lists all bookings for administrators/front desk, or only the authenticated customer's bookings.
- `POST /api/bookings` creates an upcoming booking. Customers book for themselves; staff can choose a customer.
- `PATCH /api/bookings/:id` lets administrators/front desk mark a booking completed or cancelled.

All protected routes authenticate with the existing session system. Client components never access PostgreSQL directly.

## Database

The project uses raw parameterized SQL through `pg`; it does not use Prisma, Drizzle, Express, Hono, or another backend framework.

The current migration creates:

- `roles`, `users`, and `sessions` for account/session infrastructure.
- `barbers`: `first_name`, `last_name`, `status`, optional `commission_rate`, `services_done`, `revenue`, `rating`, timestamps.
- `customers`: unique `user_id`, `phone`, nullable `preferred_barber_id`, `loyalty_points`, timestamps.
- `inventory_items`: `name`, `category`, `quantity`, `minimum_stock`, `unit_cost`, timestamps.
- `bookings`: customer, barber, service snapshot, price, date, time, status, and timestamps. An active barber/date/time slot is unique.

The migration is wrapped in a transaction by `scripts/db-migrate.ts`. Passwords are hashed with Node's `crypto.scrypt`; plaintext passwords are never stored or returned.

## Validation and authorization

`server/schemas/user.schema.ts` validates login and account creation. `server/schemas/sprint.schema.ts` validates customer, barber, inventory, and booking input. Strict schemas reject unknown fields, and route handlers return field-level validation errors as JSON.

`server/auth/require-admin.ts` protects administrator-only user-management routes. `server/auth/require-role.ts` protects staff resources. Customer profile routes check the authenticated user's role and resolve the customer by `user_id`, so customers cannot select another customer record by ID.

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The public landing page remains usable when the database is unavailable. Database-backed workspace screens show explicit loading, error, and empty states until PostgreSQL is configured and migrated. Booking options use the small service catalog in `barracks-pwa/app/data/services.ts`; payments, notifications, calendar sync, and email confirmations are not included.
