# Barracks PWA Demo Guide

This guide is for presenting the current Barracks Barbers & Shaves sprint showcase locally.

## Start the demo

From the repository root:

```bash
cd barracks-pwa
set -a
source .env.local
set +a
npm run db:migrate
npm run db:seed-admin
npm run db:seed-demo
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo seed is repeatable. Rerunning `npm run db:seed-demo` updates the demo records instead of creating duplicates. It does not delete or reset other local records.

## Demo accounts

### Administrator

Use the administrator values configured in `.env.local`:

```text
Email: admin@example.com
Password: the value of INITIAL_ADMIN_PASSWORD
```

The administrator can access the Management workspace and switch to Shop floor.

### Front Desk

```text
Email: demo.frontdesk@barracks.local
Password: frontdesk123
```

Front Desk users open directly in the Shop floor workspace. They can manage customers, barbers, and inventory, but cannot see or enter Management.

### Customer

```text
Email: demo.customer.ana@barracks.local
Password: customer123
```

Customers can only access their own customer dashboard and profile. The other seeded customer accounts use the same password:

```text
demo.customer.paulo@barracks.local
demo.customer.samira@barracks.local
demo.customer.jethro@barracks.local
```

These are local demo credentials only. Do not use them in production.

## Suggested walkthrough

1. Start on the public landing page and open **Login**.
2. Sign in as the Administrator.
3. Show the Management dashboard and its seeded summary counts.
4. Open **Staff** to show administrator-only account management.
5. Open **Barbers** to inspect and manage the roster, summary metrics, and each barber’s services, revenue, commission, and rating.
6. Open **Inventory** and show the In Stock, Low Stock, and Out of Stock states.
7. Use the account menu to switch to Shop floor.
8. Sign out and sign in as Front Desk. Confirm that the Management selector is not visible.
9. Open **Customers** to show the seeded customer profiles and preferred barbers.
10. Sign out and sign in as the demo Customer to show the unified customer account dashboard, including profile details and appointments.
11. Open **Book**, choose a service, barber, date, and time, then confirm the appointment.
12. Sign back in as Front Desk and open **Bookings** to see the saved appointment and mark it completed or cancelled.

## Seeded showcase data

- Four barbers with available, busy, and unavailable statuses.
- Six inventory items across Supplies, Products, and Equipment.
- Four customer profiles with phone numbers, preferred barbers, and loyalty points.
- Two upcoming bookings connected to the seeded customers and barbers.
- One Front Desk account.

The booking flow is intentionally small: one-time appointments with one service, barber, date, and time. Transactions, payments, queue management, and real visit history remain out of scope.

## Troubleshooting

If the database commands fail, confirm that PostgreSQL is running and that `.env.local` contains the correct local `DATABASE_URL`.

Database scripts do not load `.env.local` automatically, so run this before migration or seeding:

```bash
set -a
source .env.local
set +a
```

If the app was already running before `.env.local` was created or changed, restart it with `Ctrl+C`, then run `npm run dev` again.
