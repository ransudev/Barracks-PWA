# Isolated local demo

The user selected a compatible disposable database to finish booking walkthroughs. No connection or schema change was applied to the original demo database. The original localhost:3000 app is retained.

- App: http://localhost:3001 (bound to 127.0.0.1), production build of the final implementation, including the unavailable-metric correction.
- PostgreSQL17: 127.0.0.1:55432, database `barracks_layout_demo`, role `layout_demo`.
- Connection: `postgresql://layout_demo@127.0.0.1:55432/barracks_layout_demo`
- `DATABASE_SSL=false`; loopback-only disposable cluster uses trust authentication.
- Ignored app configuration: `barracks-pwa/.env.layout-demo.local`. It contains only isolated-demo configuration and a generated initial-demo administrator secret. Do not commit it.
- Cluster/logs: `C:/Users/Lance/.codex/local-runtimes/barracks-layout-demo/`. App process18060 is agent-created. Existing PostgreSQL service and existing app processes are retained.

All21 repository migrations were applied with `node --env-file=.env.layout-demo.local --import tsx scripts/db-migrate.ts`, followed by existing administrator and demo seed scripts against that local URL. Seven weekday rows are unique, resolving the409 for these walkthroughs without modifying scheduling rules. Existing seeded Front Desk/Manager `.app` demo accounts are usable.

Start the app from barracks-pwa:

```powershell
node --env-file=.env.layout-demo.local node_modules/next/dist/bin/next start -p 3001 -H 127.0.0.1
```

Start the cluster if stopped:

```powershell
& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' -D 'C:/Users/Lance/.codex/local-runtimes/barracks-layout-demo/data' -l 'C:/Users/Lance/.codex/local-runtimes/barracks-layout-demo/postgres.log' -o '-p 55432 -h 127.0.0.1' -w start
```

## Completed manual booking walkthrough

Created Ana Mercado / Signature Shave / Andrei today at13:00 through authoritative available slots. Edited on mobile to13:30–14:00; persisted booking#173. Explicit Check In → Start Service → Complete succeeded and drawer restrictions changed with each saved state. Cancelled seeded future booking#159 via the confirmation dialog. Screenshots `isolated-booking-create-desktop.png`, `isolated-booking-edited-mobile.png`, `isolated-booking-checkedin-mobile.png`, `isolated-booking-completed-mobile.png`, `isolated-booking-cancelled-mobile.png`.

The guarded local-render-fixtures.sql creates synthetic cancelled historical overlap and unknown-duration records; no active overlap constraint is bypassed. Final calendar has separate interval lanes for10:00–10:45 confirmed and10:15–11:00 cancelled records, a long synthetic customer name, and an unknown duration listed separately without invented time geometry. `isolated-booking-overlap-desktop.png`, `isolated-booking-duration-unavailable-desktop.png`. Empty Luis day shows0records and schedule context: `isolated-booking-empty-day-desktop.png`. The current booking model requires an assigned barber; unassigned bookings are not a supported input. The existing nine-barber original demo capture verified dense-roster lookup.

This database is disposable and independent. The demo mutations above intentionally remain for inspection. The original demo409 remains a configuration limit of that instance, but no longer blocks phase acceptance using the selected compatible environment.

## Unavailable-state walkthrough and recovery

Temporarily stopped only this agent-created local PostgreSQL cluster. Bookings, Payments, Front Desk overview, Management overview, Transactions, Attendance, Restocks and Shop hours showed explicit errors/unavailable states. Loading text was observed while Bookings refreshed; screenshots isolated-*-error.png record settled failures. A discovered Front Desk metric defect was corrected so failed data loads display dashes for all four primary metrics. ESLint and production build passed after that change; the rebuilt app was used for the final outage capture. The local cluster was restarted and the healthy Management overview verified in isolated-management-restored.png. Original service and app were not stopped. Parent Barber roster metric behavior is preexisting and outside the deferred full-roster redesign.
