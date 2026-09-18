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

`npm run db:seed-demo` replaces the local business/demo dataset in one transaction. It preserves administrator accounts but removes old customers, staff, barbers, inventory, bookings, suppliers, restocks, movements, services, and transactions before loading the current Sprint 2 showcase data. Use it only for local/demo databases.

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

Front Desk users open directly in the Shop floor workspace. They can manage customer contact/preferences, barber roster details, and inventory, but cannot see or enter Management. Loyalty points and barber ratings remain administrator-only; barber service totals are read-only.

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

### Supplier

```text
Email: demo.supplier.nina@barracks.local
Password: supplier123
```

The second seeded supplier account is `demo.supplier.marco@barracks.local` with the same password.

## Suggested walkthrough

1. Start on the public landing page and open **Login**.
2. Sign in as the Administrator.
3. Show the Management dashboard and its seeded summary counts, including low-stock items and open restocks.
4. Open **Staff** to show administrator-only account management.
5. Create a temporary staff account, open its details, verify it, block/unblock it, and show the real status badges. New accounts cannot sign in until verified.
6. Open **Barbers** to inspect and manage the roster, summary metrics, and each barber’s services, revenue, commission, and rating.
7. Open **Suppliers** to show the two supplier records and supplier login setup.
8. Open **Restocks** to show pending, delivered, and received requests. Receive the delivered request and confirm inventory and movement history update.
9. Open **Inventory** and show the linked suppliers, In Stock/Low Stock/Out of Stock states, filters, and movement history.
10. Use the account menu to switch to Shop floor.
11. Sign out and sign in as Front Desk. Confirm that the Management selector and User Management are not visible; create/update inventory and barber records, but note delete actions are administrator-only.
12. Open **Customers** to show the seeded customer profiles and preferred barbers.
13. Sign out and sign in as the demo Customer to show the unified customer account dashboard, including profile details and appointments.
14. Open **Book**, choose a service, barber, date, and time, then confirm the appointment.
15. Sign back in as Front Desk and open **Bookings** to see the saved appointment and mark it completed or cancelled.

## Seeded showcase data

- Four barbers with available, busy, and unavailable statuses.
- Two active suppliers, each with a supplier portal account.
- Seven supplier-linked inventory items across Supplies, Products, and Equipment, including low-stock items.
- Three restock requests in Pending, Delivered, and Received states, plus one audited receiving movement.
- Four customer profiles with phone numbers, preferred barbers, and loyalty points.
- Four bookings across upcoming, completed, and cancelled states, plus one persisted transaction.
- One Front Desk account.

New accounts created from Management start unverified. Use the account details view to verify them before testing login; blocking an account revokes its active sessions.

The booking flow is intentionally small: one-time appointments with one service, barber, date, and time. Payment entry and queue management remain legacy reference screens; the Sprint 2 database includes transaction records for the relational foundation.

## Troubleshooting

If the database commands fail, confirm that PostgreSQL is running and that `.env.local` contains the correct local `DATABASE_URL`.

Database scripts do not load `.env.local` automatically, so run this before migration or seeding:

```bash
set -a
source .env.local
set +a
```

If the app was already running before `.env.local` was created or changed, restart it with `Ctrl+C`, then run `npm run dev` again.
