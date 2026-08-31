# Run Barracks locally

This guide is for running Barracks on your own computer. You do not need to understand the code first—follow the steps in order.

## What you need

Install these two programs before starting:

- Node.js `20.9.0` or newer: [nodejs.org](https://nodejs.org/)
- PostgreSQL: [postgresql.org/download](https://www.postgresql.org/download/)

You also need this project folder on your computer.

## 1. Open the project folder

Open Terminal and move into the Next.js app folder. Replace the path below if your project is somewhere else:

```bash
cd "/Users/your-name/Documents/Barracks Prototype/barracks-pwa"
```

Check that you are in the right folder:

```bash
ls
```

You should see files such as `package.json` and `.env.example`.

## 2. Check that Node.js and PostgreSQL are installed

Run:

```bash
node --version
psql --version
```

The Node.js version should be `20.9.0` or newer. If either command says `command not found`, install the missing program and open a new Terminal window.

## 3. Start PostgreSQL

PostgreSQL must be running before Barracks can use customer, barber, inventory, booking, or login data.

If you installed PostgreSQL with an app, open that app and start the database server. If you use Homebrew on macOS, the command is usually:

```bash
brew services start postgresql
```

If your Homebrew installation uses a versioned PostgreSQL service, use the version shown by `brew services list`, for example `postgresql@16`.

Create the local database once:

```bash
createdb barracks
```

If it says the database already exists, that is okay—continue to the next step.

## 4. Install the app packages

Make sure you are still inside `barracks-pwa/`, then run:

```bash
npm install
```

This downloads the packages the app needs. You normally only need to run it once, or after the dependencies change.

## 5. Create your local settings file

Copy the example settings file:

```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor. Use these local values unless your PostgreSQL setup uses a different username or password:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/barracks
DATABASE_SSL=false
DATABASE_POOL_MAX=10

INITIAL_ADMIN_FIRST_NAME=Admin
INITIAL_ADMIN_LAST_NAME=User
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=choose-a-long-random-password
```

Change `INITIAL_ADMIN_PASSWORD` to a password you will remember. Do not share or commit `.env.local`; it contains private database and login settings.

## 6. Load the settings in Terminal

The Next.js app reads `.env.local` automatically, but the database setup scripts need you to load it into the current Terminal window:

```bash
set -a
source .env.local
set +a
```

Run this again whenever you open a new Terminal window before running a migration or seed command.

## 7. Set up the database

Run these commands one at a time:

```bash
npm run db:migrate
npm run db:seed-admin
npm run db:seed-demo
```

What they do:

- `db:migrate` creates the tables Barracks needs.
- `db:seed-admin` creates the administrator account from `.env.local`.
- `db:seed-demo` adds repeatable sample barbers, customers, inventory, bookings, and a Front Desk account.

The demo seed is safe to run again. It updates the demo records instead of creating duplicates.

## 8. Start Barracks

Run:

```bash
npm run dev
```

When you see that the server is ready, open [http://localhost:3000](http://localhost:3000) in your browser.

Keep this Terminal window open while using the app. To stop the app, press `Ctrl+C` in that window.

## 9. Sign in

Use the administrator email and password from `.env.local`:

```text
Email: the value of INITIAL_ADMIN_EMAIL
Password: the value of INITIAL_ADMIN_PASSWORD
```

You can also try the seeded demo accounts:

```text
Front Desk
Email: demo.frontdesk@barracks.local
Password: frontdesk123

Customer
Email: demo.customer.ana@barracks.local
Password: customer123
```

See [DEMO_README.md](DEMO_README.md) for the recommended walkthrough.

## If something goes wrong

### `command not found: node` or `command not found: psql`

Install the missing program, close Terminal, open it again, and repeat the version check in step 2.

### `database "barracks" does not exist`

Start PostgreSQL, then run:

```bash
createdb barracks
```

If your database uses a different name, update the database name at the end of `DATABASE_URL` in `.env.local`.

### `connection refused` or `ECONNREFUSED`

PostgreSQL is probably not running. Start it, confirm that `.env.local` has the right username, password, host, port, and database name, then rerun the failed command.

### A script says an environment variable is required

Load `.env.local` in the same Terminal window:

```bash
set -a
source .env.local
set +a
```

Then run the database command again.

### Login does not work

Check that the migration and administrator seed completed successfully. Use the exact email and password from `.env.local`. For the demo accounts, use the credentials listed above.

### Port 3000 is already in use

Start the app on another port:

```bash
npm run dev -- --port 3001
```

Then open [http://localhost:3001](http://localhost:3001).

## Useful commands

Run these from `barracks-pwa/`:

```bash
npm run dev          # Start the development server
npm run lint         # Check code style
npx tsc --noEmit     # Check TypeScript
npm run build        # Create a production build
npm run start        # Serve the production build
```
