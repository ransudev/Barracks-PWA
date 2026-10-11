# Dependency and harness evidence

Verified 2026-10-11, Asia/Manila. Local P0 work only; T010–T012 complete locally. Final identity and aggregate verification are recorded at the end and in E03/E05.

## Baseline and remediation

Node 26.7.0, npm 11.19.0, Windows x64. Installed Next.js upgrading guide `node_modules/next/dist/docs/01-app/01-getting-started/18-upgrading.md` read before changes. Initial `npm audit --json` returned 10 package findings: one critical Next.js package and nine high package findings (propagated package counts are not unique advisories).

Selected Next.js 16.3.8 and matching eslint-config-next 16.3.8, the smallest stable patch covering every reported Next advisory. Registry latest was 16.4.0; the unnecessary minor upgrade was not selected. `npm install --save-exact next@16.3.8 eslint-config-next@16.3.8`, then `npm audit fix` updated vulnerable transitive packages within compatible ranges: Sharp 0.35.5, brace-expansion 1.1.21/5.0.12, js-yaml 4.3.2, source-map-js 1.2.2. React 19.2.8 unchanged. npm also synchronized the already-present Netlify plugin root manifest entry in the lockfile; it did not newly add the adapter to package.json.

Authoritative GitHub-reviewed advisories opened and checked against the graph:

- [Windows server RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36): patched 16.3.3; this workstation uses Windows. Hosted filesystem identity remains a separate release check.
- [AVIF image optimization RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4): patched 16.3.3. App imports next/image and allows images.unsplash.com; do not infer current image contents eliminate exposure.
- [next/og RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j): no app next/og import found, upgrade still resolves the affected framework.
- [Image optimizer SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4): patched 16.3.8; app image optimization enabled.
- [Sharp librsvg vulnerability](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): patched graph resolves Sharp 0.35.5.
- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): no patched version published; npm registry latest remained 3.0.3.

The remaining Next cache, development MCP and metadata advisories reported in the baseline audit all end before 16.3.8. Source search found no draftMode or use-cache directive; framework upgraded independent of that exposure inference.

## Residual advisory disposition

`npm audit --omit=dev --json`: exit 0, zero vulnerabilities (runtime graph). Full audit: exit 1, five high package findings, all deriving from unpatched braces via micromatch > fast-glob > @next/eslint-plugin-next > eslint-config-next. This is developer/lint tooling only; the runtime graph omits it. The project uses fixed repository globs, not an HTTP endpoint accepting user patterns. Avoid evaluating untrusted glob patterns and recheck for an upstream patch before release. No audit suppression, version override, or incompatible suggested eslint-config-next 14.2.35 downgrade was used.

## Checks actually performed

- Baseline `npm test` without DB configuration: 134 tests, 69 pass, 17 fail, 48 skip. Skips were baseline missing DB evidence, never passing critical regressions.
- Baseline lint: two PaymentPage manual-memoization errors and one unused supplierBranches warning.
- Final `npm run lint`: exit 0, no warnings/errors after pure month-bound calculation and unused variable removal.
- Final `npx tsc --noEmit`: exit 0, no diagnostics.
- Fresh install: first workspace `npm ci` encountered Windows EPERM deleting a running esbuild executable. `npm install` restored node_modules, exit 0. To avoid concurrent-agent file locks, copied only package.json/package-lock.json to isolated `%TEMP%/barracks-readiness-install-20261011` and ran `npm ci --prefix <that-directory>`: exit 0, 418 packages installed. No workspace env files copied.
- Payment DOM harness: 8/8 pass, zero skipped. Other repaired attendance, barber, report and navigation harness scenarios passed in the last scoped run (10/10); payment failures in that intermediate aggregate run were corrected and verified by the subsequent 8/8 run.
- Payment DB regressions: payment-actions 3/3 and booking-migration 7/7 pass after fixture repairs in race-migration-check.log (zero skips). Earlier payment-foundation run had two migration deadlocks with competing local runners; root repaired extension ownership and runs aggregate verification.
- Final default Turbopack production build and loopback production start passed on 523a97f (see E05/E06).

## Harness changes and preserved coverage

DOM harness now sets the browser `self` global where Next Link expects it; a Node registerHooks CSS-module loader preserves class names for report component imports. Test command imports that hook before tsx. The hook requires Node 22.15+ or 23.5+; this machine uses 26.7.0.

Selectors follow current week/daily attendance, weekly-shifts/shop-hours tabs, visit buttons, explicit checkout confirmation, transaction month calendar/daily modal, and drawer animation completion. Assertions retain role controls, full monetary snapshots, duplicate submission prevention, branch reloads, persisted receipt printing, 20-row day pagination, and correction history. Navigation expectation includes existing payroll navigation. Payment financial DB assertions now enforce the established pending post-payment void policy with unchanged sale/tender/audit state; failed refund status writes still prove rollback atomicity. Migration recovery compares recorded count with discovered migration files instead of stale fixed 28.

Raw local command outputs: baseline-tests.log, baseline-lint.log, harness-check.log, payment-harness.log, payment-db-check.log, dependency-lint.log, dependency-typecheck.log. They contain only fixture identifiers and local diagnostics; final aggregate evidence remains authoritative for release gates.


## Follow-up interval review and regressions

Read-only review found starts checking a post-lock DB clock but persisting `NOW()`, which can predate the lock wait and shorten the recorded active interval. Root replaced start timestamps with `clock_timestamp()` and added structured reason/interval responses. New `tests/service-start-races.test.ts` verifies appointment own-reservation exclusion and immutable duration after catalog edits, legacy unresolved walk-in denial with unchanged state, simultaneous reservation/start serialization, and post-lock started_at plus denial of a later overlapping reservation. All four executed and passed on the disposable database, zero skipped (`start-races-check.log`). The concurrency barrier follows `pg_blocking_pids` transitively so both operations are demonstrably waiting before releasing the barber lock; it does not infer a race from a sleep. Initial fixture failures were corrected by using a verified account-backed customer and following indirect lock blockers; product assertions were retained. Booking migration assertions dynamically discover migration count and explicitly assert legacy walk-in duration remains null.

Final aggregate on source 523a97f: 154/154 tests, zero skipped; default Turbopack production build, lint, type checking and loopback production startup passed. See [E05](evidence.md), [final-tests.log](final-tests.log), and [final-build.log](final-build.log). No supported alternate builder is required by the project.
