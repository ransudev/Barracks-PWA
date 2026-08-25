# Barracks System Overview

This document describes the system as it exists today. The active application is the Next.js project in `barracks-pwa/`. Generated folders such as `node_modules`, `.next`, and `.vercel` are not included.

For installation and local development, see [running.md](running.md).

## 1. System Overview

The project is a Next.js App Router application. The browser renders the frontend UI, and the same Next.js application also provides the current backend API. The implemented server-backed area is user management and login/session handling. Many other screens still use static sample data, React state, or browser `localStorage`.

The current server-backed request path is:

```text
Frontend UI
    ↓
app/lib/api.ts
    ↓
Next.js Route Handler in app/api/
    ↓
Session authentication, authorization, and validation
    ↓
Server service in server/services/
    ↓
PostgreSQL pool in server/db/pool.ts
    ↓
PostgreSQL database
```

Each layer has a focused responsibility:

- `app/` contains the frontend UI and App Router entry points.
- `app/lib/api.ts` makes same-origin requests such as `fetch("/api/users")`. Browser requests include same-origin cookies automatically.
- `app/api/` contains Next.js Route Handlers. These receive HTTP requests and return JSON responses.
- `server/auth/` reads the current session cookie and enforces administrator access for user-management routes.
- `server/schemas/` validates incoming data with Zod.
- `server/services/` contains user-management, password, and session logic.
- `server/db/` creates the PostgreSQL connection pool and stores SQL migrations.
- PostgreSQL stores roles, users, and persisted sessions.

The application also has a separate client-only path for many screens:

```text
Frontend UI
    ↓
React state and app/data/
    ↓
Browser localStorage for selected screens
```

Those screens do not currently call a backend API.

## 2. Project Structure

Relevant source structure:

```text
.
├── README.md
├── SYSTEM_OVERVIEW.md
└── barracks-pwa/
    ├── app/
    │   ├── api/
    │   │   ├── auth/
    │   │   │   ├── login/route.ts
    │   │   │   ├── logout/route.ts
    │   │   │   └── me/route.ts
    │   │   ├── health/route.ts
    │   │   └── users/
    │   │       ├── route.ts
    │   │       └── [id]/route.ts
    │   ├── components/
    │   │   ├── layout/
    │   │   └── ui/
    │   ├── data/
    │   ├── hooks/
    │   ├── lib/
    │   │   └── api.ts
    │   ├── pages/
    │   │   ├── admin/
    │   │   ├── auth/
    │   │   ├── customer/
    │   │   ├── public/
    │   │   └── staff/
    │   ├── types/
    │   ├── utils/
    │   ├── layout.tsx
    │   └── page.tsx
    │
    ├── server/
    │   ├── auth/
    │   │   ├── require-admin.ts
    │   │   └── session.ts
    │   ├── db/
    │   │   ├── migrations/
    │   │   │   └── 001_user_management.sql
    │   │   └── pool.ts
    │   ├── schemas/
    │   │   └── user.schema.ts
    │   └── services/
    │       ├── password.service.ts
    │       ├── session.service.ts
    │       └── user.service.ts
    │
    ├── scripts/
    │   ├── db-migrate.ts
    │   └── seed-admin.ts
    ├── public/
    ├── package.json
    ├── next.config.ts
    └── tsconfig.json
```

Folder purposes:

- `app/`: Next.js App Router and frontend code.
- `app/api/`: HTTP endpoints implemented as Next.js Route Handlers.
- `app/components/`: Reusable layout and UI components.
- `app/pages/`: Feature-level UI components. Despite the name, this is not a separate Pages Router; `app/page.tsx` switches between these views.
- `app/lib/`: Frontend helpers, including the API request wrapper.
- `app/data/`: Static sample data used by client-side screens.
- `app/hooks/`: React hooks, including browser persistence through `localStorage`.
- `app/types/`: Frontend domain types.
- `app/utils/`: Formatting, downloads, and view-related helpers.
- `server/auth/`: Server-only session lookup and administrator authorization.
- `server/db/`: PostgreSQL pool setup and SQL migrations.
- `server/schemas/`: Zod input schemas and validation error formatting.
- `server/services/`: Server-side business logic, password hashing, and session persistence.
- `scripts/`: Developer scripts for database migrations and the initial administrator seed.

## 3. API Routes

Only these API routes currently exist:

### `POST /api/auth/login`

- Route Handler: `app/api/auth/login/route.ts`
- Authentication: Not required; this route creates the session.
- Behavior: Validates the email and password, finds the user by email, verifies the stored password hash, creates a database-backed session, and sets an HTTP-only `barracks_session` cookie.
- Success response: `200` with the public user record. The password and password hash are never returned.
- Error behavior: `400` for invalid JSON or failed validation, `401` for invalid credentials, and `500` for an unexpected server or database failure.

### `POST /api/auth/logout`

- Route Handler: `app/api/auth/logout/route.ts`
- Authentication: A session is not required to call it.
- Behavior: Deletes the current database session when one exists and expires the session cookie.
- Success response: `200` with `{ success: true, message: "Signed out" }`.

### `GET /api/auth/me`

- Route Handler: `app/api/auth/me/route.ts`
- Authentication: A valid session is required.
- Behavior: Reads the HTTP-only session cookie, looks up the session and user, and returns the current public user record.
- Error behavior: `401` when no valid session exists and `500` for an unexpected server or database failure.

### `GET /api/health`

- Route Handler: `app/api/health/route.ts`
- Authentication: Not required.
- Behavior: Returns `{ "success": true, "service": "barracks-backend" }`.
- Database access: None. The service name is a legacy response value; the endpoint is now inside the Next.js app.

### `GET /api/users`

- Route Handler: `app/api/users/route.ts`
- Authentication: A valid session for a user with the `administrator` role is required.
- Behavior: Lists user accounts without password hashes.
- Database access: Queries users joined with their roles, ordered by newest creation time first.
- Success response: `{ success: true, users }`.
- Error behavior: `401` when unauthenticated, `403` for `barber` or `front_desk`, and `500` for an unexpected server or database failure.

### `POST /api/users`

- Route Handler: `app/api/users/route.ts`
- Authentication: A valid session for a user with the `administrator` role is required.
- Behavior: Validates and creates a user account with one of the roles `administrator`, `barber`, or `front_desk`.
- Required input fields: `firstName`, `lastName`, `email`, `password`, and `role`.
- Success response: `201` with the created public user record.
- Error behavior: `400` for invalid JSON or failed validation, `409` if the email already exists, `401` when unauthenticated, `403` for a non-administrator, and `500` for an unexpected server or database failure.

### `GET /api/users/:id`

- Route Handler: `app/api/users/[id]/route.ts`
- Authentication: A valid session for a user with the `administrator` role is required.
- Behavior: Looks up one user by numeric ID and returns the public user record without the password hash.
- Error behavior: `400` for a non-positive or non-numeric ID, `404` when the user does not exist, `401` when unauthenticated, `403` for a non-administrator, and `500` for an unexpected server or database failure.

There are currently no user update, delete, password-change, password-reset, or role-management API routes.

## 4. User Request Flow

### Login and current-user lookup

The login page sends the credentials to `/api/auth/login`. The server validates the input, verifies the password against the stored scrypt hash, creates a random opaque session token, stores only its SHA-256 hash in the `sessions` table, and sends the raw token in an HTTP-only cookie. The browser cannot read that cookie through JavaScript.

When the app starts, it calls `/api/auth/me` to restore the signed-in user. The server reads the cookie, checks that the stored session exists and has not expired, then returns the public user record.

### Retrieving users

```text
StaffManagement.tsx
    ↓
apiRequest("/api/users")
    ↓
app/api/users/route.ts - GET
    ↓
server/auth/session.ts - read barracks_session cookie
    ↓
server/auth/require-admin.ts - require role administrator
    ↓
server/services/user.service.ts - listUsers()
    ↓
server/db/pool.ts - pool.query()
    ↓
PostgreSQL SELECT with roles join
    ↓
Public user records returned as JSON
    ↓
StaffManagement.tsx displays the records
```

The handler rejects the request before the user query when there is no valid session or when the current user is not an administrator. `listUsers()` selects only public user columns, joins `users` and `roles`, orders the results, and converts database column names to the frontend shape.

### Creating a user

```text
StaffManagement.tsx form
    ↓
apiRequest("/api/users", { method: "POST", body: ... })
    ↓
app/api/users/route.ts - POST
    ↓
Session lookup and administrator role check
    ↓
Parse JSON
    ↓
createUserSchema.safeParse(body)
    ↓
server/services/user.service.ts - createUser()
    ↓
BEGIN transaction
    ↓
Check duplicate email and look up role
    ↓
Hash password
    ↓
INSERT user row
    ↓
Read the created public user
    ↓
COMMIT
    ↓
Created user returned as JSON
```

The service handles the database transaction. It checks for an existing email, verifies that the requested role exists, hashes the password, inserts the new row, reads the created public record, and commits. Duplicate email errors are converted to a `409` response. The frontend displays the server's success or validation message.

## 5. Database Layer

The project uses raw PostgreSQL through the `pg` package. It does not currently use Prisma, Drizzle, Hono, Express, or another backend framework.

### Connection pool

`server/db/pool.ts` creates one `pg.Pool` using:

- `DATABASE_URL` for the PostgreSQL connection string.
- `DATABASE_SSL=true` to enable SSL with `rejectUnauthorized: false`.
- `DATABASE_POOL_MAX` for the maximum pool size, defaulting to `10`.

The pool also logs unexpected pool-level errors.

### Queries

SQL is written directly in the server services and executed through `pool.query()` or a checked-out pool client. User creation uses a client transaction with `BEGIN`, `COMMIT`, and `ROLLBACK`. Query parameters are passed separately from SQL strings.

### Migrations

The current migration is stored at:

```text
server/db/migrations/001_user_management.sql
```

It creates the `roles` and `users` tables, seeds the three supported roles, creates a case-insensitive unique email index, creates an index on `users.role_id`, and creates the `sessions` table used for login sessions.

Migrations are run with:

```bash
npm run db:migrate
```

This runs `scripts/db-migrate.ts`. The script reads the SQL file, opens a PostgreSQL client, executes the migration inside a transaction, commits on success, rolls back on failure, and closes the pool.

### Initial administrator seed

After the migration, the initial administrator can be created with:

```bash
npm run db:seed-admin
```

The script reads the `INITIAL_ADMIN_*` environment variables, validates them with the same user schema, hashes the password, and inserts an administrator only when that email does not already exist. Running it again for the same administrator email makes no changes. It refuses to treat an existing non-administrator account as the initial administrator.

## 6. Validation

User input schemas are stored in:

```text
server/schemas/user.schema.ts
```

`createUserSchema` validates:

- Non-empty first and last names, up to 100 characters each.
- A valid email address, up to 320 characters.
- A password between 8 and 128 characters.
- A role from `administrator`, `barber`, or `front_desk`.
- No unknown fields, because the object schema is strict.

`loginSchema` validates a trimmed, lowercased email and a non-empty password.

For `POST /api/auth/login`, login validation happens before a database lookup. For `POST /api/users`, authorization happens first, then the body is parsed as JSON and Zod validation happens before the service or database is called. Validation failures are returned as `400` responses with field-level error messages.

The user ID in `GET /api/users/:id` is validated directly in the Route Handler. It must contain only digits and represent a number greater than zero.

## 7. Password Handling

Password hashing and verification are implemented in:

```text
server/services/password.service.ts
```

The service uses Node.js `crypto.scrypt` with a randomly generated 16-byte salt. The stored value contains the algorithm parameters, salt, and derived key in a `$`-separated format. Login derives a key from the submitted password and compares it with the stored value using a timing-safe comparison.

The user service hashes the password before the `INSERT` query. Public user queries do not select the password hash, and API responses never include it. Plain-text passwords must never be stored in PostgreSQL.

## 8. Authorization

### Implemented now

The current authorization flow is session-based:

- `POST /api/auth/login` verifies a user password and sets an HTTP-only `barracks_session` cookie.
- The session token is random and opaque. Only its SHA-256 hash is stored in PostgreSQL.
- Sessions expire after seven days.
- `server/auth/session.ts` resolves the cookie to the current user.
- `server/auth/require-admin.ts` requires the current user's role to be `administrator`.
- The user-management routes return `401` without a valid session and `403` for `barber` or `front_desk` users.
- `POST /api/auth/logout` deletes the session and expires the cookie.

### Temporary or limited parts

The initial administrator is created through the manual `npm run db:seed-admin` bootstrap script. There is no UI or API for changing roles, updating users, deleting users, or resetting passwords. The current session system is enough for this sprint's login and administrator-only user management, but it is not a complete account-lifecycle system.

### Not implemented yet

- Password reset email or reset-token handling.
- User update, delete, or role-management endpoints.
- Session revocation for all sessions belonging to a user.
- Rate limiting or multi-factor authentication.

The browser-side `NEXT_PUBLIC_ADMIN_API_TOKEN` has been removed. `ADMIN_API_TOKEN` is also no longer used. Values with the `NEXT_PUBLIC_` prefix are made available to browser code and can be exposed in the client bundle, so private tokens and database credentials must never use that prefix. The current `app/lib/api.ts` sends no private token from the browser.

## 9. Environment Variables

The expected variables are documented in `barracks-pwa/.env.example`:

```text
DATABASE_URL
DATABASE_SSL
DATABASE_POOL_MAX
INITIAL_ADMIN_FIRST_NAME
INITIAL_ADMIN_LAST_NAME
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

- `DATABASE_URL`: PostgreSQL connection string used by `pg`.
- `DATABASE_SSL`: When set to `true`, enables the pool's SSL configuration.
- `DATABASE_POOL_MAX`: Maximum number of PostgreSQL connections in the pool. The code defaults to `10` when it is absent.
- `INITIAL_ADMIN_FIRST_NAME`: First name used only by the initial administrator seed script.
- `INITIAL_ADMIN_LAST_NAME`: Last name used only by the initial administrator seed script.
- `INITIAL_ADMIN_EMAIL`: Email used to find or create the initial administrator.
- `INITIAL_ADMIN_PASSWORD`: Password used only when the initial administrator is first created.

The `INITIAL_ADMIN_*` values are needed only when running `npm run db:seed-admin`. No actual secret values belong in this document or in committed source code. These variables must remain server-only and must not be renamed with a `NEXT_PUBLIC_` prefix.

Obsolete variables from the previous separate-server setup are not used by the current application: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_API_TOKEN`, `ADMIN_API_TOKEN`, `CORS_ORIGIN`, and `PORT`.

## 10. Current Dependencies

- **Next.js**: Runs the App Router application and the Route Handlers.
- **React**: Renders the client-side UI and manages component state.
- **TypeScript**: Provides static typing for the frontend, Route Handlers, services, and scripts.
- **`pg`**: Provides the PostgreSQL connection pool and query execution.
- **Zod**: Validates login and user-creation input and formats validation errors.
- **`tsx`**: Runs the TypeScript database migration and administrator seed scripts.
- **`@types/pg`**: TypeScript declarations for `pg`.

The project does not currently use Hono, `@hono/node-server`, Prisma, Drizzle, Express, or another backend framework.

## 11. What Is Currently Implemented

Implemented in the current codebase:

- A Next.js App Router application with a client-driven home view at `/`.
- A public landing page with static content and images.
- The public landing menu is maintained in `barracks-pwa/app/data/landing.ts`, including grouped services, product pricing, booking contact details, GCash information, social handle, and hashtag.
- The landing services menu uses a text-first responsive slideshow; service pricing remains visible without relying on service photography, and the public navigation items share a consistent header alignment.
- Public landing supporting copy, controls, prices, and metadata use an accessibility-focused readable type floor while preserving the existing display headings.
- The public service slideshow is centered within a compact menu width on larger screens, with centered indicators so service names, prices, and navigation remain visually connected.
- The public footer keeps its main columns and legal/booking row in a stacked layout so both share the same content grid.
- The final booking CTA keeps phone and GCash details together when its supporting copy wraps on mobile.
- Barber portraits use the shared public/barber-placeholder.png silhouette asset until approved Barracks photography is available.
- Login against the PostgreSQL `users` table.
- HTTP-only, database-backed sessions with login, logout, and current-user endpoints.
- Administrator-only user-management authorization.
- User-management API routes for listing users, creating users, and retrieving one user.
- Administrator bootstrap through the idempotent `npm run db:seed-admin` script.
- Zod validation for login and new-user input.
- PostgreSQL access through a shared `pg` pool.
- User, role, and session database migration through `npm run db:migrate`.
- Scrypt password hashing and verification.
- A health endpoint at `/api/health`.
- A frontend API helper that calls same-origin `/api/...` URLs without exposing private credentials.
- Staff-management UI connected to the real list/create user API.
- Local client interactions for queue, bookings, customers, inventory, payments, barbers, services, profile settings, and related screens.
- Browser persistence for selected client-side state through `localStorage`.

## 12. What Is Not Implemented Yet

Verified unfinished or incomplete areas include:

- User update and delete operations.
- User password changes through the API.
- Password reset email or reset-token handling.
- Role changes through the API.
- Customer signup persistence. The current signup form only validates local input and shows a message that it is not connected.
- Password recovery. The current recovery form only shows a local confirmation message.
- Backend APIs for appointments, bookings, customers, reports, inventory, payments, barbers, or services.
- Database persistence for most non-user-management frontend screens. Their data comes from `app/data/`, React state, or `localStorage`.
- Automatic administrator provisioning. The initial administrator must be created by running the seed script with server-side environment variables.

The presence of a screen or button in the frontend does not mean that a corresponding backend feature exists.

## 13. Development Flow

For a new backend-backed feature, follow the existing pattern:

```text
1. Create the Route Handler under app/api/.
2. Add or reuse session/role checks when the endpoint is protected.
3. Add a Zod schema under server/schemas/ if request input needs validation.
4. Add focused business logic under server/services/.
5. Use server/db/pool.ts for PostgreSQL queries.
6. Add a migration under server/db/migrations/ if the database schema must change.
7. Connect the frontend through app/lib/api.ts using a relative /api/... URL.
8. Update README.md and SYSTEM_OVERVIEW.md when the system changes.
```

Keep request parsing and HTTP response formatting in the Route Handler. Keep database and business operations in server services. Do not place database queries in client components or expose server-only environment variables.

## 14. Architecture Rules

- UI belongs under the frontend `app` structure.
- HTTP endpoints belong under `app/api` as Next.js Route Handlers.
- Server-only logic belongs under `server`.
- Database credentials must never be exposed to client code.
- Private tokens and session secrets must never use the `NEXT_PUBLIC_*` prefix.
- Client code should call relative `/api/...` URLs.
- Client components must not query PostgreSQL directly.
- Database, password, session, and authorization code must remain server-only.
- Use the existing `server/services/` and `server/schemas/` patterns for new backend features.
- Do not add another backend framework when a Next.js Route Handler is sufficient.
- Update the repository README when code, configuration, dependency, database, API, or architecture behavior changes.
