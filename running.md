# Run Barracks locally

This guide is for running Barracks on your own computer. You do not need to understand the code first—follow the steps in order.

## What you need

Install these two programs before starting:

- Node.js `20.9.0` or newer: [nodejs.org](https://nodejs.org/)
- PostgreSQL: [postgresql.org/download](https://www.postgresql.org/download/)

You also need this project folder on your computer.

## 1. Open the project folder

Open a command window and move into the Next.js app folder. Replace the example path if your project is somewhere else.

On macOS, open **Terminal** and run:

```bash
cd "/Users/your-name/Documents/Barracks Prototype/barracks-pwa"
ls
```

On Windows, open **PowerShell** and run:

```powershell
cd "C:\Users\your-name\Documents\Barracks Prototype\barracks-pwa"
Get-ChildItem
```

You should see files such as `package.json` and `.env.example`.

## 2. Check that Node.js and PostgreSQL are installed

Run this in either Terminal or PowerShell:

```bash
node --version
psql --version
```

The Node.js version should be `20.9.0` or newer. If either command is not found, install the missing program and open a new command window.

## 3. Start PostgreSQL

PostgreSQL must be running before Barracks can use customer, barber, inventory, booking, or login data.

On macOS, if you installed PostgreSQL with an app, open that app and start the database server. If you use Homebrew, the command is usually:

```bash
brew services start postgresql
```

If your Homebrew installation uses a versioned PostgreSQL service, use the version shown by `brew services list`, for example `postgresql@16`.

On Windows, open **SQL Shell (psql)** or **pgAdmin**, start PostgreSQL, and create a database named `barracks`. In pgAdmin, right-click **Databases**, choose **Create → Database**, enter `barracks`, and save.

You can also create it from PowerShell if the PostgreSQL commands are on your PATH:

```powershell
createdb -U postgres barracks
```

On macOS, create the local database once with:

```bash
createdb barracks
```

If it says the database already exists, that is okay—continue to the next step.

## 4. Install the app packages

Make sure you are still inside `barracks-pwa/`, then run this in either Terminal or PowerShell:

```bash
npm install
```

This downloads the packages the app needs. You normally only need to run it once, or after the dependencies change.

## 5. Create your local settings file

Copy the example settings file.

On macOS:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
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

### Optional: use the Supabase database

The application can use Supabase without changing the frontend or API code. Keep the local values above for local development. For a hosted environment, use the Supabase transaction-pooler connection string for the `simplecrudapp` project instead:

```text
DATABASE_URL=<Supabase transaction-pooler connection string>
DATABASE_SSL=true
DATABASE_POOL_MAX=3
```

Apply the Barracks migration and demo seed to that database before starting the hosted app. Keep the connection string server-only; do not prefix it with `NEXT_PUBLIC_` or paste it into client-side code. Vercel uses its own environment variables, so switching Vercel to Supabase does not replace or modify your local PostgreSQL database.

## 6. Load the settings in your command window

The Next.js app reads `.env.local` automatically. The database setup scripts need you to load the settings into the current command window first.

On macOS, run:

```bash
set -a
source .env.local
set +a
```

On Windows PowerShell, run:

```powershell
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "Env:$name" -Value $value
    }
}
```

Run the matching command again whenever you open a new command window before running a migration or seed command. Keep that window open while completing the next step.

## 7. Set up the database

Run these commands one at a time in either Terminal or PowerShell:

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

Keep the command window open while using the app. To stop the app, press `Ctrl+C` in that window.

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

### `command not found: node`, `command not found: psql`, or a Windows command is not recognized

Install the missing program, close the command window, open it again, and repeat the version check in step 2.

### PowerShell says that `npm.ps1` cannot be loaded

Use `npm.cmd` instead of `npm` in that PowerShell window. For example:

```powershell
npm.cmd install
npm.cmd run dev
```

### `database "barracks" does not exist`

Start PostgreSQL, then run the command for your computer.

On macOS:

```bash
createdb barracks
```

On Windows, use pgAdmin as described in step 3, or run:

```powershell
createdb -U postgres barracks
```

If your database uses a different name, update the database name at the end of `DATABASE_URL` in `.env.local`.

### `connection refused` or `ECONNREFUSED`

PostgreSQL is probably not running. Start it, confirm that `.env.local` has the right username, password, host, port, and database name, then rerun the failed command.

### A script says an environment variable is required

Load `.env.local` in the same command window. On macOS:

```bash
set -a
source .env.local
set +a
```

On Windows PowerShell, run:

```powershell
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "Env:$name" -Value $value
    }
}
```

Then run the database command again.

### Login does not work

Check that the migration and administrator seed completed successfully. Use the exact email and password from `.env.local`. For the demo accounts, use the credentials listed above.

### Port 3000 is already in use

Start the app on another port. This command works in both macOS Terminal and Windows PowerShell:

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
