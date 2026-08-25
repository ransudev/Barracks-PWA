# Running Barracks Locally

This guide explains how to install and run the Barracks Next.js application from a fresh checkout.

Run all commands from the Next.js project directory:

```bash
cd barracks-pwa
```

## Requirements

- Node.js `20.9.0` or newer
- npm
- PostgreSQL running locally or on an accessible server
- A PostgreSQL database named `barracks` (or another database name in `DATABASE_URL`)

Check your Node.js version:

```bash
node --version
```

## 1. Install dependencies

From `barracks-pwa/`, install the dependencies from the lockfile:

```bash
npm install
```

## 2. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and update the PostgreSQL connection details and initial administrator values:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/barracks
DATABASE_SSL=false
DATABASE_POOL_MAX=10

INITIAL_ADMIN_FIRST_NAME=Admin
INITIAL_ADMIN_LAST_NAME=User
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=choose-a-long-random-password
```

Do not commit `.env.local`. Database credentials and the initial administrator password are server-only secrets.

The Next.js development server loads `.env.local` automatically. The standalone TypeScript database scripts do not, so export the values before running migrations or the administrator seed:

```bash
set -a
source .env.local
set +a
```

Run that command again in a new terminal session before using the database scripts.

## 3. Apply the database migration

Make sure PostgreSQL is running and the database in `DATABASE_URL` exists. Then run:

```bash
npm run db:migrate
```

This creates the `roles`, `users`, and `sessions` tables, seeds the supported roles, and creates the required indexes.

## 4. Create the initial administrator

After the migration succeeds, run:

```bash
npm run db:seed-admin
```

The script creates the administrator using the `INITIAL_ADMIN_*` values. Running it again with the same administrator email is safe and makes no changes.

## 5. Start the development server

Start Next.js in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser and sign in with the administrator email and password from `.env.local`.

The health endpoint can be checked from another terminal:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"success":true,"service":"barracks-backend"}
```

## Useful commands

Run the linter:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Start the production build locally:

```bash
npm run start
```

Start the development server on another port if `3000` is already in use:

```bash
npm run dev -- --port 3001
```

## Common problems

### PostgreSQL connection refused

Make sure PostgreSQL is running, the database exists, and `DATABASE_URL` uses the correct username, password, host, port, and database name.

### Seed script says an environment variable is required

The database scripts do not load `.env.local` automatically. Run this in the same terminal before the script:

```bash
set -a
source .env.local
set +a
```

Then run `npm run db:seed-admin` again.

### Login does not work

Confirm that the migration ran successfully, the administrator seed completed, and that you are using the exact email and password configured in the seed environment variables. The password placeholder in `.env.example` is not a usable password until you replace it.
