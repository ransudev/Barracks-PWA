# Barracks backend

This service contains the administrator-only User Management → Create/Categorize User Account feature.

## Setup

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and ADMIN_API_TOKEN in .env
npm run db:migrate
npm run dev
```

The API listens on `http://localhost:8787` by default. User-management requests must include either:

```text
Authorization: Bearer <ADMIN_API_TOKEN>
```

or:

```text
X-Admin-Token: <ADMIN_API_TOKEN>
```

The token is deliberately required because this repository does not yet contain a login/session service. The user routes are therefore not accessible to a newly created barber or front-desk account. The stored role is returned on every public user record so a future authenticated feature route can apply role-specific authorization.

## API

- `POST /api/users` creates an account and assigns `administrator`, `barber`, or `front_desk`.
- `GET /api/users` lists accounts without password hashes.
- `GET /api/users/:id` returns one account without its password hash.

Passwords are hashed with Node's built-in scrypt implementation before they are written to PostgreSQL.
