# Barracks System Overview

This document describes the system as it exists today. The active Next.js application is in `barracks-pwa/`. Generated folders such as `node_modules`, `.next`, and `.vercel` are intentionally not included here.

## 1. System Overview

The project is a Next.js App Router application. The browser renders the frontend UI. Only the user-management area currently uses the backend and PostgreSQL. Most other screens use static sample data and browser `localStorage`.

The server-backed request path is:

```text
Frontend UI
    ↓
app/lib/api.ts
    ↓
Next.js Route Handler in app/api/
    ↓
Authorization and validation
    ↓
Server service in server/services/
    ↓
PostgreSQL pool in server/db/pool.ts
    ↓
PostgreSQL database
```

Each layer has a focused responsibility:

- `app/` contains the frontend UI and the App Router entry points.
- `app/lib/api.ts` makes same-origin HTTP requests such as `fetch("/api/users")`.
- `app/api/` contains Next.js Route Handlers. These receive HTTP requests and return JSON responses.
- `server/auth/` checks the current temporary admin token.
- `server/schemas/` validates incoming data with Zod.
- `server/services/` contains user-management and password logic.
- `server/db/` creates the PostgreSQL connection pool and stores SQL migrations.
- PostgreSQL stores roles and user accounts.

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
├── SYSTEM_OVERVIEW.md
└── barracks-pwa/
    ├── app/
    │   ├── api/
    │   │   ├── health/
    │   │   │   └── route.ts
    │   │   └── users/
    │   │       ├── route.ts
    │   │       └── [id]/
    │   │           └── route.ts
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
    │   │   └── require-admin.ts
    │   ├── db/
    │   │   ├── migrations/
    │   │   │   └── 001_user_management.sql
    │   │   └── pool.ts
    │   ├── schemas/
    │   │   └── user.schema.ts
    │   └── services/
    │       ├── password.service.ts
    │       └── user.service.ts
    │
    ├── scripts/
    │   └── db-migrate.ts
    ├── public/
    ├── package.json
    ├── next.config.ts
    └── tsconfig.json
```

Folder purposes:

- `app/`: Next.js App Router and frontend code.
- `app/api/`: HTTP API endpoints implemented as Next.js Route Handlers.
- `app/components/`: Reusable layout and UI components.
- `app/pages/`: Feature-level UI components. Despite the name, this is not a separate Pages Router; the main `app/page.tsx` switches between these views.
- `app/lib/`: Frontend helpers, currently including the API request wrapper.
- `app/data/`: Static sample data used by the client-side screens.
- `app/hooks/`: React hooks, including browser persistence through `localStorage`.
- `app/types/`: Frontend domain types.
- `app/utils/`: Formatting, downloads, and view-related helpers.
- `server/auth/`: Server-only authorization helpers.
- `server/db/`: PostgreSQL pool setup and SQL migrations.
- `server/schemas/`: Zod input schemas and validation error formatting.
- `server/services/`: Server-side business logic and password hashing.
- `scripts/`: Developer scripts such as the database migration runner.

## 3. API Routes

Only these API routes currently exist:

### `GET /api/health`

- Route Handler: `app/api/health/route.ts`
- Authentication: Not required.
- Behavior: Returns `{ "success": true, "service": "barracks-backend" }`.
- Database access: None.

### `GET /api/users`

- Route Handler: `app/api/users/route.ts`
- Authentication: Required through the temporary administrator-token check.
- Behavior: Lists user accounts without password hashes.
- Database access: Queries users joined with their roles, ordered by newest creation time first.
- Success response: `{ success: true, users }`.
- Error behavior: Returns `503` if `ADMIN_API_TOKEN` is not configured, `403` for a missing or invalid token, and `500` for a database failure.

### `POST /api/users`

- Route Handler: `app/api/users/route.ts`
- Authentication: Required through the temporary administrator-token check.
- Behavior: Validates and creates a user account with one of the roles `administrator`, `barber`, or `front_desk`.
- Required input fields: `firstName`, `lastName`, `email`, `password`, and `role`.
- Success response: `201` with the created public user record.
- Error behavior:
  - `400` for invalid JSON or failed validation.
  - `400` if the role is unavailable.
  - `409` if the email already exists.
  - `403` or `503` for authorization problems.
  - `500` for an unexpected database or service failure.

### `GET /api/users/:id`

- Route Handler: `app/api/users/[id]/route.ts`
- Authentication: Required through the temporary administrator-token check.
- Behavior: Looks up one user by numeric ID and returns the public user record without the password hash.
- Error behavior:
  - `400` for a non-positive or non-numeric ID.
  - `404` when the user does not exist.
  - `403` or `503` for authorization problems.
  - `500` for an unexpected database or service failure.

There are currently no user update, delete, login, logout, password-reset, or role-management API routes.

## 4. User Request Flow

### Retrieving users

```text
StaffManagement.tsx
    ↓
apiRequest("/api/users")
    ↓
app/api/users/route.ts - GET
    ↓
requireAdministrator(request)
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

The `GET` handler first checks authorization. If the request is authorized, `listUsers()` runs a parameter-free `SELECT` query that joins `users` and `roles`, orders the results, and converts database column names to the frontend shape. The password hash is never selected or returned.

### Creating a user

```text
StaffManagement.tsx form
    ↓
apiRequest("/api/users", { method: "POST", body: ... })
    ↓
app/api/users/route.ts - POST
    ↓
requireAdministrator(request)
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

The service handles the database transaction. It checks for an existing email, verifies that the requested role exists, hashes the password, inserts the new row, reads the created public record, and commits. Duplicate email errors are converted to a `409` response.

The frontend API wrapper uses relative URLs and does not attach an admin token. Therefore, the protected browser requests currently require a separate authenticated request flow that has not been implemented yet.

## 5. Database Layer

The project uses PostgreSQL through the `pg` package. It does not currently use Prisma, Drizzle, or another ORM.

### Connection pool

`server/db/pool.ts` creates one `pg.Pool` using:

- `DATABASE_URL` for the PostgreSQL connection string.
- `DATABASE_SSL=true` to enable SSL with `rejectUnauthorized: false`.
- `DATABASE_POOL_MAX` for the maximum pool size, defaulting to `10`.

The pool also logs unexpected pool-level errors.

### Queries

SQL is written directly in `server/services/user.service.ts` and executed through `pool.query()` or a checked-out pool client. User creation uses a client transaction with `BEGIN`, `COMMIT`, and `ROLLBACK`. Query parameters are passed separately from SQL strings.

### Migrations

The current migration is stored at:

```text
server/db/migrations/001_user_management.sql
```

It creates the `roles` and `users` tables, seeds the three supported roles, creates a case-insensitive unique email index, and creates an index on `users.role_id`.

Migrations are run with:

```bash
npm run db:migrate
```

This runs `scripts/db-migrate.ts`. The script reads the SQL file, opens a PostgreSQL client, executes the migration inside a transaction, commits on success, rolls back on failure, and closes the pool.

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

For `POST /api/users`, authorization happens first. The request body is then parsed as JSON, and Zod validation happens before the service or database is called. Validation failures are returned as a `400` response with field-level error messages.

The user ID in `GET /api/users/:id` is validated directly in the Route Handler. It must contain only digits and represent a number greater than zero.

## 7. Password Handling

Password hashing is implemented in:

```text
server/services/password.service.ts
```

It uses Node.js `crypto.scrypt` with a randomly generated 16-byte salt. The stored value contains the algorithm parameters, salt, and derived key in a `$`-separated format.

The user service hashes the password before the `INSERT` query. The plain-text password is not selected in user queries and is not included in public API responses. Plain-text passwords should never be stored in PostgreSQL.

## 8. Authorization

### Implemented now

`server/auth/require-admin.ts` implements a temporary shared-token check:

- The server reads `ADMIN_API_TOKEN`.
- The request may present a token through `X-Admin-Token` or `Authorization: Bearer <token>`.
- The presented token is compared with the configured token using a timing-safe comparison.
- Missing server configuration returns `503`.
- A missing or incorrect request token returns `403`.
- The user routes call this helper before accessing the database.

### Temporary

This is a static administrator token, not a complete authentication system. It exists because the project does not currently have a login/session service.

### Not implemented yet

- User login verification against PostgreSQL.
- Session or cookie creation.
- Logout and session expiry.
- Role-aware sessions.
- Password reset.
- A secure browser flow that supplies authenticated credentials to the protected user routes.

The browser-side `NEXT_PUBLIC_ADMIN_API_TOKEN` has been removed. Values with the `NEXT_PUBLIC_` prefix are made available to browser code and can be exposed in the client bundle, so private administrator tokens and database credentials must never use that prefix. The current `app/lib/api.ts` sends no private token from the browser.

## 9. Environment Variables

The expected server-side variables are documented in `barracks-pwa/.env.example`:

```text
DATABASE_URL
DATABASE_SSL
DATABASE_POOL_MAX
ADMIN_API_TOKEN
```

- `DATABASE_URL`: PostgreSQL connection string used by `pg`.
- `DATABASE_SSL`: When set to `true`, enables the pool's SSL configuration.
- `DATABASE_POOL_MAX`: Maximum number of PostgreSQL connections in the pool. The code defaults to `10` when it is absent.
- `ADMIN_API_TOKEN`: Temporary private token required by the protected user routes.

No actual secret values belong in this document or in committed source code. These variables must remain server-only and must not be renamed with a `NEXT_PUBLIC_` prefix.

## 10. Current Dependencies

- **Next.js**: Runs the App Router application and the Route Handlers.
- **React**: Renders the client-side UI and manages component state.
- **TypeScript**: Provides static typing for the frontend, Route Handlers, services, and scripts.
- **`pg`**: Provides the PostgreSQL connection pool and query execution.
- **Zod**: Validates incoming user-creation data and formats validation errors.
- **`tsx`**: Runs the TypeScript database migration script from the npm script.
- **`@types/pg`**: TypeScript declarations for `pg`.

The project does not currently use Hono, Prisma, Drizzle, Express, or another backend framework.

## 11. What Is Currently Implemented

Implemented in the current codebase:

- A Next.js App Router application with a client-driven home view at `/`.
- A public landing page with static content and images.
- Staff, administrator, and customer UI views rendered from the main app shell.
- User-management API routes for listing users, creating users, and retrieving one user.
- Temporary administrator-token authorization for the user-management API.
- Zod validation for new user input.
- PostgreSQL access through a shared `pg` pool.
- User and role database migration through `npm run db:migrate`.
- Scrypt password hashing before a user is inserted.
- A health endpoint at `/api/health`.
- A frontend API helper that calls same-origin `/api/...` URLs.
- Local client interactions for queue, bookings, customers, inventory, payments, barbers, services, profile settings, and related screens.
- Browser persistence for selected client-side state through `localStorage`.

The staff-management UI is wired to the user API, but the protected requests do not currently receive a browser authentication credential.

## 12. What Is Not Implemented Yet

Verified unfinished or incomplete areas include:

- Proper login authentication against the `users` table.
- Session, cookie, logout, and session-expiry handling.
- A secure browser authentication flow for protected user-management requests.
- User update and delete operations.
- User password changes through the API.
- Password reset email or reset-token handling.
- Customer signup persistence. The current signup form only validates local input and shows a message that it is not connected.
- Password recovery. The current recovery form only shows a local confirmation message.
- Backend APIs for appointments, bookings, customers, reports, inventory, payments, barbers, or services.
- Database persistence for most frontend screens. Their data comes from `app/data/`, React state, or `localStorage`.

The presence of a screen or button in the frontend does not mean that a corresponding backend feature exists.

## 13. Development Flow

For a new backend-backed feature, follow the existing pattern:

```text
1. Create the Route Handler under app/api/.
2. Add a Zod schema under server/schemas/ if request input needs validation.
3. Add focused business logic under server/services/.
4. Use server/db/pool.ts for PostgreSQL queries.
5. Add a migration under server/db/migrations/ if the database schema must change.
6. Connect the frontend through app/lib/api.ts using a relative /api/... URL.
```

Keep request parsing and HTTP response formatting in the Route Handler. Keep database and business operations in the server service. Do not place database queries in client components.

## 14. Architecture Rules

- UI belongs under the frontend `app` structure.
- HTTP endpoints belong under `app/api` as Next.js Route Handlers.
- Server-only logic belongs under `server`.
- Database credentials must never be exposed to client code.
- Private tokens must never use the `NEXT_PUBLIC_*` prefix.
- Client code should call relative `/api/...` URLs.
- Client components must not query PostgreSQL directly.
- Database and authentication code must remain server-only.
- Use the existing `server/services/` and `server/schemas/` patterns for new backend features.
- Do not add another backend framework when a Next.js Route Handler is sufficient.
