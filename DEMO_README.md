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

`npm run db:seed-demo` initializes a fresh disposable demo database in one transaction. It preserves administrator accounts, but attempts to remove existing business data; finalized financial records and attendance prevent destructive reseeding. On an already populated demo database, run `npm run db:refresh-demo` to add activity while preserving current records. Use these commands only for demo databases.

## Demo accounts

### Administrator

Use the administrator values configured in `.env.local`:

```text
Email: admin@example.com
Password: the value of INITIAL_ADMIN_PASSWORD
```

The administrator can access the Management workspace and switch to Front Desk.

### Front Desk

```text
Email: demo.frontdesk@barracks.app
Password: frontdesk123
```

Front Desk users open directly in the Front Desk workspace. They can manage customer contact/preferences, barber roster details, and inventory, but cannot see or enter Management. Loyalty points and barber ratings remain administrator-only; barber service totals are read-only.

### Manager

```text
Email: demo.manager@barracks.app
Password: manager123
```

Managers open in the Management workspace and can manage day-to-day business operations, including customers, barbers, suppliers, inventory, restocks, reports, and bookings. Staff account administration remains administrator-only.

### Customer

```text
Email: demo.customer.ana@barracks.app
Password: customer123
```

Customers can only access their own customer dashboard and profile. The other seeded customer accounts use the same password:

```text
demo.customer.paulo@barracks.app
demo.customer.samira@barracks.app
demo.customer.jethro@barracks.app
```

These are local demo credentials only. Do not use them in production.

### Supplier

```text
Email: demo.supplier.nina@barracks.app
Password: supplier123
```

The second seeded supplier account is `demo.supplier.marco@barracks.app` with the same password.

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
10. Use the workspace switcher to switch to Front Desk.
11. Sign out and sign in as Front Desk. Confirm that the Management selector and User Management are not visible; create/update inventory and barber records, but note delete actions are administrator-only.
12. Open **Customers** to show the seeded customer profiles and preferred barbers.
13. Sign out and sign in as the demo Customer to show the unified customer account dashboard, including profile details and appointments.
14. Open **Book**, choose a service, barber, date, and time, then confirm the appointment.
15. Sign back in as Front Desk and open **Bookings** to see the saved appointment and mark it completed or cancelled.
16. Sign out and sign in as the demo Supplier to show the supplier portal: the linked profile, supplied items, open restock requests, and delivery history. Suppliers can only advance their own requests from Pending through Accepted, Preparing, and Shipped — receiving stays with staff.

## Seeded showcase data

- Four barbers with a working queue and an unavailable roster member.
- Two active suppliers, each with a supplier portal account.
- Twenty-six supplier-linked inventory items across Supplies, Products, and Equipment, including all 21 products shown on the public landing page and low-stock items.
- Three restock requests in Pending, Delivered, and Received states, plus one audited receiving movement.
- Four customer accounts plus 12 accountless customer profiles with realistic names and phone numbers.
- Four weeks of completed, cancelled, and no-show visits, paid receipts across cash/card/e-wallet, and a week of upcoming appointments. Existing reservations can reduce the number of new appointments.
- Fourteen days of attendance history plus today's attendance; waiting, ready, in-progress, and completed unpaid walk-ins demonstrate the queue and checkout flow.
- One Manager account and one Front Desk account.

New accounts created from Management start unverified. Use the account details view to verify them before testing login; blocking an account revokes its active sessions.

The booking flow uses one service, barber, date, and time. Front Desk can manage the queue and check out the completed unpaid walk-in. Payments have persisted visit identities and matching tenders; revenue reports include dated history rather than a single sale. The additive refresh also retains the four-branch stock/restock examples. Existing accounts, completed sales, request progress, and staff attendance edits remain intact.

## Troubleshooting

If the database commands fail, confirm that PostgreSQL is running and that `.env.local` contains the correct local `DATABASE_URL`.

Database scripts do not load `.env.local` automatically, so run this before migration or seeding:

```bash
set -a
source .env.local
set +a
```

If the app was already running before `.env.local` was created or changed, restart it with `Ctrl+C`, then run `npm run dev` again.
