# Barracks Barbers & Shaves — Codebase Overview

This document describes the current implementation of the Barracks Barbers & Shaves frontend: its structure, runtime composition, domain model, state management, UI system, module behavior, development workflow, and the boundaries that remain before production integration.

It is intentionally written against the code that exists in this repository rather than the original prototype brief. Some product documents describe a mock-only frontend; the implementation has since grown into an interactive, browser-persisted frontend with working forms, modals, local mutations, exports, and role-oriented workspaces. It still has no server, authentication provider, database, or payment gateway.

## 1. Executive summary

Barracks is a desktop-first barbershop operations application with three user-facing experiences:

- A public marketing and service-discovery landing page.
- A customer account area for appointments, profile information, history, and loyalty context.
- An internal workspace for front-desk staff and administrators.

The internal workspace is implemented as a single-page shell. The app does not currently use multiple Next.js URL routes for each module. Instead, `app/page.tsx` owns a `ViewId` state value and renders the active page component through `PageRouter`. This keeps the prototype fast to navigate and easy to demonstrate, but it also means the browser URL does not identify the current module.

The application is intentionally client-heavy. Most module pages are React client components that manage local form state, modal visibility, filtering, and mutations. Seed data lives in TypeScript modules under `app/data`; operational lists are persisted to `window.localStorage` through `usePersistentState`.

### Current implementation at a glance

| Area | Current behavior |
| --- | --- |
| Framework | Next.js `16.3.1` App Router with React `19.2.8` |
| Entry point | `app/page.tsx` at the single `/` route |
| Routing model | In-app `ViewId` switching through `app/pages/PageRouter.tsx` |
| Styling | One design-system stylesheet in `app/globals.css`; Tailwind PostCSS is installed but the UI primarily uses authored CSS classes |
| Typography | Geist and Geist Mono from `next/font/google`; serif display styling is used selectively for the public wordmark/marketing treatment |
| State | React state plus browser `localStorage` persistence for selected operational modules |
| Data | Typed seed data in `app/data`; no API or database |
| Authentication | Simulated login validation only; no session, token, or authorization layer |
| Payments | Local transaction creation only; no payment processor |
| Exports | Client-side CSV downloads using `Blob` and a temporary anchor element |
| Testing | No test runner or automated test suite is configured |
| Production readiness | Strong interactive frontend foundation; backend, auth, data integrity, observability, and automated coverage remain to be added |

## 2. Repository structure

The important application files are organized by responsibility rather than by route. The `tmp/` directory may exist locally as untracked reference material and is not part of the application architecture.

```text
.
├── AGENTS.md                         # Repository-specific agent and Next.js guidance
├── CLAUDE.md                         # References the repository instructions
├── DESIGN.md                         # Visual, interaction, and architecture direction
├── PRODUCT.md                        # Product context, audience, and original constraints
├── README.md                         # Generic project setup/readme from the starter
├── package.json                      # Scripts and dependencies
├── next.config.ts                    # Next.js configuration (currently minimal)
├── tsconfig.json                     # Strict TypeScript configuration and @/* alias
├── postcss.config.mjs                # Tailwind CSS v4 PostCSS plugin
├── next-env.d.ts                     # Next.js generated type declarations
├── public/                           # Static public assets and favicon
└── app/
    ├── layout.tsx                    # Root HTML shell, fonts, metadata, global CSS import
    ├── page.tsx                      # Client entry point and top-level application state
    ├── globals.css                   # Tokens, shared components, layout, and page styles
    ├── components/
    │   ├── layout/
    │   │   └── AppShell.tsx           # Staff/admin sidebar, topbar, workspace shell
    │   └── ui/
    │       ├── index.tsx              # Shared UI primitives
    │       └── icons.tsx              # Central SVG icon catalog and Icon component
    ├── constants/
    │   └── navigation.ts              # Staff/admin navigation and admin view list
    ├── data/
    │   ├── index.ts                   # Data barrel export
    │   ├── barbers.ts                 # Barber seed records
    │   ├── bookings.ts                # Booking seed records
    │   ├── customers.ts               # Customer seed records
    │   ├── inventory.ts               # Inventory seed records
    │   ├── landing.ts                 # Public service options
    │   ├── queue.ts                   # Queue seed records
    │   ├── reports.ts                 # Revenue and customer report seed data
    │   ├── services.ts                # Service catalog seed records
    │   ├── staff.ts                   # Staff member seed records
    │   └── transactions.ts            # Payment/transaction seed records
    ├── hooks/
    │   └── usePersistentState.ts      # LocalStorage-backed React state hook
    ├── pages/
    │   ├── PageRouter.tsx             # ViewId-to-page switchboard
    │   ├── public/
    │   │   └── LandingPage.tsx
    │   ├── auth/
    │   │   └── LoginPage.tsx
    │   ├── customer/
    │   │   └── CustomerProfile.tsx
    │   ├── staff/
    │   │   ├── StaffDashboard.tsx
    │   │   ├── QueuePage.tsx
    │   │   ├── BookingsPage.tsx
    │   │   ├── CustomersPage.tsx
    │   │   ├── PaymentPage.tsx
    │   │   ├── InventoryPage.tsx
    │   │   └── SettingsPage.tsx
    │   └── admin/
    │       ├── AdminDashboard.tsx
    │       ├── StaffManagement.tsx
    │       ├── BarbersManagement.tsx
    │       ├── ServicesManagement.tsx
    │       ├── ReportsPage.tsx
    │       ├── InventoryPage.tsx
    │       └── SettingsPage.tsx
    ├── types/
    │   └── domain.ts                 # Shared domain types and view identifiers
    └── utils/
        ├── download.ts               # CSV download helper
        ├── format.ts                 # Currency, initials, and slug helpers
        └── view.ts                   # Admin-view classification helper
```

## 3. Runtime composition

### Root layout

`app/layout.tsx` is the only Next.js layout currently in use. It:

1. Loads Geist and Geist Mono through `next/font/google`.
2. Imports `app/globals.css` once for the entire application.
3. Sets the document language to English.
4. Defines the page metadata title as `Barracks | Barbers & Shaves`.
5. Renders the active page tree inside the document body.

The root layout is a server component by default. Client behavior begins at `app/page.tsx` and flows down into the interactive page components.

### Application entry point

`app/page.tsx` is the top-level client component and acts as the composition root. Its responsibilities are:

- Holding the current `view` (`ViewId`).
- Providing the `go(nextView)` navigation callback.
- Holding transient toast state.
- Owning the persisted queue and inventory arrays that are shared with multiple staff/admin pages.
- Choosing whether the current internal view uses the staff or admin shell.
- Rendering the public landing page, login page, customer page, or internal shell.

The top-level flow is:

```text
Next.js `/` route
        │
        ▼
app/page.tsx  (client composition root)
        │
        ├── landing ───────────────► LandingPage
        ├── login ─────────────────► LoginPage
        ├── customer ──────────────► CustomerProfile
        └── internal ViewId
                │
                ▼
        AppShell(area = staff | admin)
                │
                ├── Sidebar navigation
                ├── Topbar/search/profile/notifications
                └── PageRouter(view)
                        │
                        └── active module page
```

`go()` also clears the current search value and scrolls the window to the top. Navigation is therefore an in-memory transition rather than a URL transition.

### View routing

`app/pages/PageRouter.tsx` uses a `switch` over `ViewId`. It injects shared `queue`/`stock` state into the pages that need it and renders the selected page. The default branch is the staff dashboard.

`app/utils/view.ts` and `app/constants/navigation.ts` define which views belong to the admin workspace. This is a UI classification, not an authorization check. A future production authorization layer must enforce roles independently of this client-side grouping.

## 4. Navigation and workspace model

### Staff workspace

The staff navigation is defined in `app/constants/navigation.ts`:

| Label | ViewId | Purpose |
| --- | --- | --- |
| Overview | `staff-dashboard` | Front-desk operational summary, live queue preview, upcoming bookings, barber availability, activity |
| Queue | `queue` | Manage waiting customers, assign barbers, move customers through service states |
| Bookings | `bookings` | Search, filter, create, edit, inspect, and cancel appointments |
| Customers | `customers` | Search customer profiles, register customers, edit details, begin a booking request |
| Payment | `payment` | Prepare and complete local payments, inspect transaction history |
| Inventory | `inventory` | Track stock levels, add items, edit quantities and thresholds |

Staff settings is also a supported `ViewId` (`staff-settings`) and is reachable from the profile/settings affordances, although it is not part of the primary navigation list.

### Admin workspace

| Label | ViewId | Purpose |
| --- | --- | --- |
| Dashboard | `admin-dashboard` | Management-level metrics, revenue overview, barber performance, shortcuts, activity |
| Staff | `staff-management` | Add, edit, search, and enable/disable staff records |
| Barbers | `barbers` | Manage barber profiles, status, services, commission rate, and schedule view |
| Services | `services` | Manage the service catalog and active/inactive availability |
| Reports | `reports` | Revenue summaries, service performance, customer value, transactions, CSV export |
| Inventory | `admin-inventory` | Management view of the same persisted inventory collection |

Admin settings (`admin-settings`) is available as a settings view but is not listed as a primary sidebar destination.

### App shell behavior

`app/components/layout/AppShell.tsx` owns the internal navigation chrome:

- Sidebar with staff/admin navigation.
- Workspace switch action.
- Active view styling.
- Notification and count affordances.
- Profile menu and sign-out action.
- Collapsible sidebar state.
- Topbar with context, search, notifications, profile, workspace, and sign-out controls.

The expanded sidebar is approximately `238px` wide. The collapsed sidebar is approximately `72px` wide and keeps icon affordances with accessible labels/tooltips. On smaller screens, the layout reflows and the sidebar is hidden by the responsive CSS rules.

## 5. Domain model

`app/types/domain.ts` is the central type contract for the frontend. The types are deliberately small and UI-oriented, but they provide the seams needed to replace seed data with API responses later.

| Type | Main fields | Used by |
| --- | --- | --- |
| `Barber` | id, name, initials, status, services, revenue, commission, rating, customers, memberSince | Dashboard, barber management, bookings, queue |
| `Customer` | id, name, initials, phone, email, visits, points, preferredBarber, lastVisit, tone | Customer list/profile, bookings, payment, reports |
| `QueueEntry` | id, customer, initials, service, barber, status, wait, joined, tone | Staff dashboard and queue |
| `Booking` | id, time, meridiem, customer, initials, service, barber, price, status, tone | Dashboard, bookings, barber schedule |
| `InventoryItem` | id, name, category, current, minimum, maximum, unitCost | Staff/admin inventory |
| `Service` | id, name, description, duration, price, active | Landing page, booking forms, services management, payment |
| `Transaction` | id, date, customer, service, barber, method, amount, status | Payment and reports |
| `StaffMember` | id, name, initials, role, email, phone, status, joined, tone | Staff management |
| `RevenueDay` | date/label and revenue-oriented chart values | Admin dashboard and reports |
| `RevenueByService` | service label and revenue/count values | Reports and dashboard |
| `NavigationItem` | label, view, icon, count/metadata as needed | App shell navigation |

Shared unions include:

- `Tone`: `blue`, `green`, `amber`, `violet`, `red`, or `slate`.
- `ShellArea`: `staff` or `admin`.
- Status unions for barbers, queue entries, bookings, and staff members.
- `ViewId`, which is the application’s in-memory route vocabulary.

## 6. Data and persistence

### Seed data

The `app/data` directory is the initial data source for the application. It provides realistic records for the first render and keeps the module components readable. `app/data/index.ts` re-exports the individual collections.

Current seed collections include:

- Four barbers.
- Six bookings across completed, upcoming, and cancelled states.
- Six customers.
- Eight inventory items across supplies, equipment, and products.
- Three public landing-page service options.
- Five queue entries.
- Revenue-by-day, revenue-by-service, and top-customer report samples.
- Seven services, including one inactive service.
- Five staff members.
- Five transaction records.

### `usePersistentState`

`app/hooks/usePersistentState.ts` provides browser-only persistence with the following behavior:

1. The component starts with the supplied seed value.
2. After mount, a zero-delay browser timer reads the JSON value from `localStorage`.
3. Once hydration completes, later state changes are serialized back to the same key.
4. Read and write failures are swallowed so the interface continues to work in memory.

The delayed read avoids reading `window` during server rendering and prevents the persistence effect from writing the initial seed before the stored value has had a chance to load. This is a convenience persistence layer, not a synchronization or data-integrity layer.

### Persistence keys

| Key | Owner | Scope | Notes |
| --- | --- | --- | --- |
| `barracks-queue` | `app/page.tsx` | Staff queue and shared admin-facing inventory shell context | Shared through props with `QueuePage` |
| `barracks-inventory` | `app/page.tsx` | Staff and admin inventory | Shared through props with both inventory views |
| `barracks-bookings` | `BookingsPage` | Staff booking list | Not yet the single source for every dashboard/schedule view |
| `barracks-customers` | `CustomersPage` | Staff customer list | Local browser collection |
| `barracks-transactions` | `PaymentPage` | Staff payment history | Reports currently also have seeded report data |
| `barracks-staff` | `StaffManagement` | Admin staff records | Local browser collection |
| `barracks-barbers` | `BarbersManagement` | Admin barber records | Local browser collection |
| `barracks-services` | `ServicesManagement` | Admin service catalog | Local browser collection |
| `barracks-customer-profile` | `CustomerProfile` | Customer account profile | Profile edits survive reload in the same browser |
| `barracks-customer-next-visit` | `CustomerProfile` | Customer next appointment | Customer-side appointment state |

### Data ownership caveat

The current architecture is intentionally pragmatic, but it has more than one data path:

- Some operational pages use persisted collections.
- The dashboards and report pages still use seed collections directly for display.
- The barber schedule view filters the seeded booking list rather than the persisted booking list.
- The staff customer “new booking” action currently confirms the request locally with a toast; it does not append a record to the shared bookings collection.

This is acceptable for a self-contained frontend demonstration, but it must be resolved before treating the application as a real operational system. The recommended production direction is a single repository/service layer per domain object, with all pages consuming the same fetched query state and mutations.

## 7. Shared UI system

### UI primitives

`app/components/ui/index.tsx` is the shared primitive layer. It includes:

- `Logo`: reusable Barracks mark treatment.
- `Avatar`: initials/avatar styling with tone support.
- `Button`: primary, secondary, ghost, danger, success, and link variants with sizes and optional icons.
- `IconButton`: compact icon-only actions with accessible labels.
- `Badge`: status/category labels with tone styling. Status badges intentionally render without decorative bullet dots.
- `MetricCard`: KPI display with label, value, change/context, and icon.
- `PageHeader`: page title and action region.
- `SectionHeading`: section-level title and supporting action.
- `Panel`: bordered surface container, including flush mode for table/list layouts.
- `SearchInput`: consistent search field.
- `SelectField` and `TextField`: labeled form controls.
- `Toggle`: boolean preference/control input.
- `EmptyState`: empty result/collection presentation.
- `Modal`: dialog shell with backdrop, close action, title semantics, and backdrop dismissal.
- `Tabs`: tabbed filtering/navigation control.
- `ProgressBar`: compact progress visualization.
- `Toast`: transient success/error-style feedback region.

### Icons

`app/components/ui/icons.tsx` centralizes the SVG icon set. Consumers use the typed `IconName` union and the `Icon` component rather than defining one-off inline SVG markup in every page. The catalog includes navigation, action, status, and utility icons.

### Styling architecture

`app/globals.css` is the primary styling source. It is organized into broad sections for:

1. Design tokens and global reset.
2. Shared controls, panels, badges, avatars, metrics, and forms.
3. Internal app shell, sidebar, topbar, and collapsed states.
4. Dashboard and operational page layouts.
5. Customer and payment layouts.
6. Inventory, management, and reporting layouts.
7. Settings, login, and public landing-page styles.
8. Responsive breakpoints.

The visual language uses a dark mineral/ink workspace with restrained borders, paper-colored primary text, muted secondary text, and signal colors for status and emphasis. The principal token families are:

- Ink/background surfaces.
- Panel and elevated surfaces.
- Border/line colors.
- Paper/text colors.
- Blue, green, amber, violet, and red signal colors.
- Shared shadows and radii.

The public marketing surface and internal operations surface share the same brand system but use different composition rules. Public content is more editorial and spacious; internal pages use a fixed navigation rail, compact data panels, metrics, tables, and action clusters.

### Responsive behavior

The stylesheet has responsive rules around `1180px`, `980px`, and `760px`. The layout progressively:

- Reduces grid columns and panel density.
- Hides or simplifies shell context/search controls.
- Reflows metric cards and operational columns.
- Hides the desktop sidebar at mobile widths.
- Adapts modal and form layouts for narrow screens.

### Accessibility behavior

Current shared behavior includes:

- Visible `:focus-visible` outlines.
- Button labels and icon button `aria-label` values.
- Modal `role="dialog"`, `aria-modal`, and a title association.
- Keyboard-friendly native form controls where possible.
- Tooltips/titles and retained labels for collapsed sidebar icons.

The next accessibility pass should add systematic focus trapping/return for modals, escape-key handling, live-region semantics for toasts, and automated checks for every interactive page.

## 8. Module-by-module behavior

### Public landing page — `LandingPage.tsx`

The landing page is the public entry experience. It presents:

- The Barracks brand and primary call to action.
- A stylized board/artwork composition built with CSS and inline elements rather than a required raster hero asset.
- Selectable public services.
- Barber/team context.
- Visit/location information.
- Navigation into login or the customer account area.

Its current interaction state is local to the page. Selecting a service changes the active service presentation but does not yet create a booking until the user proceeds through the account/booking flow.

### Login — `LoginPage.tsx`

The login screen is a simulated staff login:

- Email and password are controlled fields.
- The password visibility toggle is local UI state.
- Email must contain `@`.
- Password must be at least eight characters.
- Successful validation shows feedback and transitions to the staff dashboard.
- “Forgot password” opens a recovery modal and validates the recovery email before confirming.

There is deliberately no staff-management/customer selector on the login screen. The current form does not authenticate against a service, create a session, or establish a real role.

### Customer account — `CustomerProfile.tsx`

The customer area includes:

- Next appointment card.
- Appointment details modal.
- Cancel appointment confirmation modal.
- New booking modal with service, barber, date, and time fields.
- Recent visits/history presentation.
- Full history modal.
- Profile edit modal.
- Loyalty/points context.

The profile and next visit values persist locally using dedicated keys. Booking and cancellation actions update the local customer-facing state and show toast feedback. They are not connected to the staff booking collection or a backend.

### Staff dashboard — `StaffDashboard.tsx`

The staff dashboard is an at-a-glance operations view containing:

- Queue and service metrics.
- Live queue preview.
- “Next on the book” upcoming booking list.
- Barber availability.
- Quick actions that navigate to operational modules.
- Today’s activity panel.

The first upcoming booking is visually prioritized. The priority treatment spans the full schedule card width while preserving the internal time/customer/price alignment. Activity rows use a three-column icon/content/value layout so metric text cannot collapse into a single horizontal line.

The dashboard currently reads seed queue, booking, and barber data directly, so its summary does not automatically recalculate from every mutation made in the persisted module pages.

### Queue — `QueuePage.tsx`

Queue is one of the more complete operational modules. It receives the persisted queue collection from `app/page.tsx` and supports:

- Queue metrics for total, currently served, and average wait.
- Status filtering.
- Add-to-queue modal.
- Customer/service/barber details in each row.
- Inline barber assignment.
- Start-chair and mark-ready transitions.
- Actions modal for the row lifecycle.
- Remove-from-queue behavior.
- Filter modal.
- Refresh action that clones the current local collection.
- Commission details modal.

The state transitions are browser-local and immediate. There is no server-side queue lock or multi-user synchronization.

### Bookings — `BookingsPage.tsx`

Bookings uses the `barracks-bookings` localStorage collection and supports:

- Today, Upcoming, Completed, and Cancelled tabs.
- Search by booking/customer context.
- Barber and service filters.
- Filter modal.
- Create booking modal.
- Row detail modal.
- Edit booking modal.
- Cancellation status update.
- Counts and summary metrics derived from the local booking collection.

This page is the main operational booking surface, but other pages still consume seeded bookings directly. Consolidating those sources is a future data-layer task.

### Customers — `CustomersPage.tsx`

Customers uses the `barracks-customers` collection and provides:

- Search and customer list filtering.
- Customer registration form.
- Selected customer detail view.
- Edit profile modal.
- New booking modal/request flow.

Customer edits and new registrations update the local customer collection. The new booking request currently confirms locally rather than writing a booking into `barracks-bookings`; this is an intentional current limitation to address during shared domain-state integration.

### Payment — `PaymentPage.tsx`

Payment is a local transaction workflow:

- Select customer, service, barber, and payment method.
- Calculate the selected service subtotal.
- Complete payment and prepend a transaction record.
- Display revenue, transaction count, and average transaction metrics.
- Open transaction history.
- Refresh the local history collection.

Supported payment methods are Cash, Card, and Mobile. No card data is collected and no external processor is called. In production, payment completion must become a server-authorized operation with a provider webhook/reconciliation strategy.

### Inventory — `InventoryPage.tsx`

The same inventory implementation is used in staff and admin contexts, with an `admin` prop controlling presentation/context. It receives the persisted stock collection from the root and supports:

- Search by item.
- Category filtering across Supplies, Equipment, and Products.
- Total item, low-stock, out-of-stock, and inventory-value metrics.
- Low-stock banner.
- Add item modal.
- Edit item modal.
- Current/minimum/maximum quantity and unit-cost editing.

The inventory action bar intentionally contains only the relevant actions; the separate Restock/Update button was removed. Stock calculations are local and do not create an audit log.

### Staff settings — `staff/SettingsPage.tsx`

Staff settings includes:

- Profile fields.
- Photo file selection affordance.
- Notification toggles.
- Password change fields and validation.
- Save feedback.
- Version/environment information.
- Sign-out navigation.

The photo selection is currently a local browser interaction with confirmation feedback; there is no upload endpoint. Profile/preferences/password values are controlled state and are not currently persisted to a server or dedicated localStorage record.

### Admin dashboard — `AdminDashboard.tsx`

The management dashboard includes:

- High-level revenue, customer, booking, and commission metrics.
- Revenue overview visualization.
- Barber performance section.
- Shortcuts into management modules.
- Today’s activity panel.
- CSV summary export through `downloadCsv`.

The visualizations use report seed data. The dashboard is a management presentation layer, not yet a live reporting query over all local mutations.

### Staff management — `StaffManagement.tsx`

The staff module persists `StaffMember` records and supports:

- Search.
- Staff metrics.
- Add staff modal.
- Edit staff modal.
- Active/disabled state action.

The current status control is a frontend state transition. There is no invitation flow, identity provider, permission matrix, or audit trail.

### Barbers — `BarbersManagement.tsx`

The barber management module persists barber records and supports:

- Barber cards and summary metrics.
- Add barber modal.
- Edit barber profile modal.
- Commission rate modal.
- Schedule modal.
- Status and service information.

The schedule view currently filters the seeded booking list. It should eventually consume the canonical booking repository and a real barber availability model.

### Services — `ServicesManagement.tsx`

Services persists the service catalog and supports:

- Add service modal.
- Edit service modal.
- Active/inactive filter modal.
- Enable/disable action.
- Service metrics.

The active flag is used to distinguish available from unavailable catalog items in the management UI. Enforcement across every booking entry point should be centralized when the API layer is introduced.

### Reports — `ReportsPage.tsx`

Reports includes:

- Date/range selection UI.
- Revenue and transaction metrics.
- Revenue by service.
- Top customer value.
- Recent transactions.
- Full ledger modal.
- CSV export of the transaction ledger.

The current report data is seeded and presentation-oriented. The range control changes the report view state but is not yet backed by a date-filtered query against persisted transactions.

### Admin settings — `admin/SettingsPage.tsx`

Admin settings provides controlled forms for:

- Business information.
- Commission settings.
- Loyalty settings and toggles.
- Notification preferences.
- Password validation.
- Resetting notification preferences.

These settings currently provide the intended management UX but do not persist to a backend configuration store.

## 9. Interaction and state flows

### Navigation flow

```text
User clicks nav/action
        │
        ▼
go(ViewId)
        │
        ├── setView(ViewId)
        ├── clear global search
        └── scroll window to top
                │
                ▼
        AppShell + PageRouter render new page
```

### Modal flow

Module pages use local boolean/object state for modal visibility and form values:

```text
Open action
   │
   ├── set modal state
   ├── initialize form state
   └── render shared Modal
           │
           ├── validate fields
           ├── update local collection or local page state
           ├── show toast
           └── close/reset modal
```

The shared `Modal` handles the visual dialog frame and backdrop dismissal. Page components own the domain-specific validation and mutation logic.

### Toast flow

Pages call the `onToast` callback passed from `app/page.tsx`. The root stores one current message and clears it after approximately 2.8 seconds. This gives all modules a consistent feedback mechanism without introducing a global state library.

### CSV export flow

`app/utils/download.ts` receives a filename, header list, and row matrix. It:

1. Escapes commas, quotes, and line breaks.
2. Builds a CSV string.
3. Creates a `Blob`.
4. Creates a temporary object URL and anchor.
5. Triggers a browser download.
6. Revokes the object URL.

This is suitable for client-side prototype exports. Production exports should usually be generated from a server-side, permission-checked query for consistent totals and large datasets.

## 10. Configuration and tooling

### Package scripts

`package.json` currently defines:

```bash
npm run dev      # Start Next.js development server
npm run build    # Create a production build
npm run start    # Serve the production build
npm run lint     # Run ESLint
```

There is no dedicated `typecheck` script, but TypeScript can be checked with:

```bash
npx tsc --noEmit
```

### TypeScript

`tsconfig.json` is strict and uses bundler module resolution. The alias `@/*` maps to the repository root, so imports such as `@/app/components/ui` resolve without long relative paths. The Next.js TypeScript plugin is enabled.

### Next.js repository instruction

`AGENTS.md` contains a repository-specific warning that this project’s Next.js version has breaking changes compared with older Next.js conventions. Before making future Next.js-specific changes, read the relevant guide under:

```text
node_modules/next/dist/docs/
```

This is especially important for changes involving routing, layouts, server/client boundaries, caching, or build configuration.

### Environment variables

There is currently no environment-variable integration, `.env` contract, API base URL, authentication secret, database URL, or payment key. Adding any of those should be accompanied by an explicit environment documentation section and safe server/client boundary decisions.

## 11. Development workflow

### Start locally

```bash
npm install
npm run dev
```

The development server normally exposes the app at `http://localhost:3000`.

### Recommended verification sequence

For a normal code change:

```bash
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

For UI changes, also verify the affected flow in a browser at desktop and mobile widths. The project contains a large authored stylesheet, so visual verification is particularly important after changing shared tokens, shell layout, modal sizing, grid templates, or responsive rules.

### Browser storage during development

Because operational data persists in `localStorage`, a browser session can retain records created during manual testing. To return to seed data, clear the site’s local storage in browser developer tools. This is a development reset only; there is no migration/versioning layer for stored data.

## 12. Current architecture strengths

- Clear separation between shared primitives, layout, page modules, domain types, seed data, hooks, and utilities.
- Typed `ViewId` and domain records reduce stringly-typed navigation and data handling.
- Shared `AppShell` gives staff and admin modules a consistent operational frame.
- Shared UI primitives keep modal, button, field, panel, badge, and metric styling consistent.
- The prototype is interactive enough to exercise representative operational tasks.
- Local persistence makes browser refreshes less destructive during demos and manual testing.
- CSV export has been isolated into a reusable utility.
- The current design system has explicit tokens and responsive rules rather than relying only on per-page inline styling.

## 13. Current limitations and technical debt

### No real routing or session model

The application has one Next route and a client-side view switcher. Refreshing or sharing a URL cannot preserve a module. Login only validates form shape and does not establish identity. Workspace choice is a UI behavior, not authorization.

### No backend or cross-user consistency

All mutations are local to one browser. Multiple staff members cannot see each other’s queue, booking, payment, or inventory changes. There are no server validations, conflict rules, audit records, or role checks.

### Multiple data sources

Seed dashboard/report/schedule data and persisted operational collections can diverge. A production data layer should establish canonical repositories and query/mutation hooks for bookings, customers, barbers, services, inventory, staff, payments, and reports.

### Incomplete mutation propagation

Some forms provide complete local feedback while stopping at the page boundary. The customer new-booking request does not yet update the staff booking list. Dashboard and reporting summaries do not universally recalculate after local mutations.

### Persistence is unversioned

Stored JSON has no schema version, migration, expiry, user namespace, or corruption recovery beyond silently falling back to memory. Production persistence should be server-owned; if client caching remains, add versioned schemas and migrations.

### Settings and files are presentation-only

Staff/admin settings are controlled forms with feedback but not durable business configuration. Profile photo selection does not upload or store an image.

### No automated tests

There are no unit, integration, component, end-to-end, accessibility, or visual regression tests configured. The highest-value initial tests would cover queue status transitions, booking creation/edit/cancel, inventory thresholds, payment totals, service activation, and login validation.

### No error/loading boundaries

The app currently assumes seed data and synchronous local operations. Production integrations will need loading states, empty/error states for failed requests, retry behavior, route-level error boundaries, and telemetry.

## 14. Recommended production evolution

The frontend is ready for a gradual replacement of local seams rather than a complete rewrite. A sensible sequence is:

1. Introduce URL-backed routes or a route-to-view adapter while preserving the existing page components.
2. Add real authentication and server-side authorization for customer, front-desk, barber, and administrator roles.
3. Define canonical backend entities and validation for customers, bookings, services, barbers, queue entries, inventory movements, staff, and transactions.
4. Replace direct seed imports/localStorage ownership with repository or query hooks.
5. Make dashboard, reports, and barber schedules consume the same canonical booking/payment data as operational modules.
6. Add inventory movement records instead of only overwriting current quantities.
7. Integrate a payment provider with server-side confirmation and webhook reconciliation.
8. Persist staff/admin settings and implement profile image storage.
9. Add automated tests and browser verification for the representative workflows.
10. Add observability, audit logging, rate limiting, and deployment environment documentation.

Possible API seam shape:

```text
UI page components
        │
        ▼
domain hooks / query + mutation adapters
        │
        ▼
repository or API client layer
        │
        ▼
authenticated backend + database + external services
```

The existing types in `app/types/domain.ts` can remain the frontend-facing contract while transport DTOs and server validation are introduced separately.

## 15. Contribution conventions

When extending the codebase:

- Put reusable visual behavior in `app/components/ui`, not in a page-specific duplicate.
- Put shell/navigation behavior in `app/components/layout`.
- Keep domain models in `app/types/domain.ts` or split them into focused type files once that file becomes too large.
- Add new seed records under `app/data` only when they are genuinely shared initial data.
- Prefer `@/app/...` imports through the configured alias.
- Keep form state and modal state close to the page that owns the workflow until a shared form abstraction is justified.
- Use `formatCurrency`, `createInitials`, and `createSlug` rather than reimplementing formatting logic.
- Use `downloadCsv` for tabular exports rather than creating ad hoc Blob logic.
- Preserve accessible labels for icon-only controls and dialogs.
- Avoid adding decorative status bullets to badges; status text and tone are the current pattern.
- Run TypeScript, lint, build, and diff checks before handing off a change.
- For Next.js-specific work, follow the repository’s `AGENTS.md` instruction to consult the installed Next.js guides first.

## 16. Useful file index

| Concern | File |
| --- | --- |
| Root composition | `app/page.tsx` |
| Document shell and metadata | `app/layout.tsx` |
| Internal navigation shell | `app/components/layout/AppShell.tsx` |
| Shared UI primitives | `app/components/ui/index.tsx` |
| SVG icon catalog | `app/components/ui/icons.tsx` |
| View switchboard | `app/pages/PageRouter.tsx` |
| Domain types | `app/types/domain.ts` |
| Navigation definitions | `app/constants/navigation.ts` |
| Browser persistence | `app/hooks/usePersistentState.ts` |
| CSV export | `app/utils/download.ts` |
| Formatting helpers | `app/utils/format.ts` |
| Admin-view classification | `app/utils/view.ts` |
| Global design system and responsive CSS | `app/globals.css` |
| Product direction | `PRODUCT.md` |
| Visual/interaction direction | `DESIGN.md` |

## 17. Bottom line

Barracks is currently a polished, typed, client-side operations frontend with a strong module and UI foundation. Its most important architectural fact is that the visible product is broader than the persistence layer: the interface supports realistic workflows and modal interactions, while the underlying data is still seeded and browser-local. The next major step is not another isolated screen; it is consolidating domain data ownership and introducing authenticated backend boundaries so that queue, bookings, customers, services, inventory, payments, dashboards, and reports all describe the same operational system.
