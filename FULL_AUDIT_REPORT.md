# JYS Full Software Audit Report

Audit date: 2026-08-03  
Repository baseline: commit `f714dff` plus the preserved, uncommitted continuation work shown by `git status`  
Scope: customer and admin routes, route handlers, authentication/session/origin behavior, PostgreSQL/Prisma data integrity, pricing/cart/inventory, responsive UI, accessibility, security, runtime behavior, dependencies, tests, build, and handover documentation.

## Executive result

The repository is healthy for the implemented single-instance scope. The initial audit corrected four confirmed defects: two medium-severity application/configuration defects and two low-severity QA-runner defects. The subsequently approved REC-003 and REC-004 work exposed and corrected two additional medium-severity defects in uploaded-image cleanup and report date boundaries. No Critical or High defect was found. PostgreSQL was reachable, all four migrations were applied, the schema matched the migration history, `npm.cmd audit` reported zero vulnerabilities, and the supported verification gates passed after the fixes.

Production still requires infrastructure and business configuration: production PostgreSQL/backups, HTTPS URLs and proxy settings, a production-only authentication secret, transactional email credentials/domain verification, durable uploaded-image storage, approved business/legal/catalog data, and physical iPhone/Android checks. These are not hidden as code passes.

## Baseline inspected

- Documentation/configuration: `package.json`, `.env.example`, `README.md`, `SETUP_CHECKLIST.md`, `QUALITY_REVIEW.md`, `IMPLEMENTATION_PLAN.md`, `FEATURE_AUDIT.md`, `next.config.ts`, `src/proxy.ts`, both Playwright configurations, and `scripts/run-e2e.ps1`.
- Database: `prisma/schema.prisma`, all four SQL migrations, `prisma/seed.ts`, `prisma/seed-policy.ts`, Prisma generation/validation, and live migration status.
- Reachable UI: all customer pages under `src/app/[locale]`, all eleven admin modules, account/order subroutes, the printable order view, mobile menus/drawers, and English/Arabic variants.
- API/security: all auth, account, cart, wishlist, checkout, catalog, admin, report/export, upload, and health route handlers; shared authorization, origin validation, parsing, rate limiting, password/reset/session, storage, pricing, cart, inventory, order, report, and CSV services.
- Repository state: the existing dirty worktree was preserved. No reset, destructive Git operation, applied-migration edit, or unrelated overwrite was performed. `git diff --check` was clean at baseline.
- Interactive evidence: the in-app browser controller reported that no browser backend was available. The repository's Playwright Chromium/WebKit projects therefore provided the executable browser interaction, network/navigation, screenshot, geometry, and accessibility-state evidence.

## A. Bugs fixed automatically

### AUD-BUG-001 — Machine-specific development origins embedded in source

- Severity: Medium
- Description: the development-origin helper permanently trusted a private LAN IP and a temporary tunnel hostname in addition to its configured origins.
- Reproduction: set `.env` to a different `DEV_ALLOWED_ORIGINS` value, then call `getAllowedDevOrigins(explicitValue)` or run `npm.cmd test`; the returned list still contained unrelated machine/tunnel hosts and two origin tests failed.
- Root cause: `src/lib/dev-origins.ts` contained literal LAN and tunnel values in the default list instead of treating them as local environment configuration.
- Files changed: `src/lib/dev-origins.ts`, `tests/unit/dev-origins.test.ts`, `.env.example`, `README.md`, `SETUP_CHECKLIST.md`.
- Fix implemented: only `127.0.0.1` and `localhost` are built in. Additional validated hostnames/IPs come exclusively from `DEV_ALLOWED_ORIGINS`. Documentation now gives non-machine-specific hosts-file, LAN, and temporary-tunnel examples and requires a server restart.
- Tests added/updated: deterministic explicit-origin expectations; a regression assertion that an empty configuration contains no LAN/tunnel value; configured IPv4 and tunnel-host validation.
- Verification: targeted 4/4 origin tests passed; full 110/110 unit/component tests passed; localhost/custom-domain Playwright 8/8 passed; production build passed.
- Migration impact: none.
- Remaining risk: Next.js development origins are intentionally a developer-controlled allowlist. Operators must remove expired tunnel hosts from `.env` and must not reuse development settings in production.

### AUD-BUG-002 — Admin shell used a static viewport and ignored display safe areas

- Severity: Medium
- Description: the mobile admin root/layout/sidebar relied only on `100vh`; the fixed drawer also used ordinary padding without notch/home-indicator safe-area insets. Mobile browser chrome changes or cutouts could clip the drawer's bottom/top controls even though ordinary emulated screenshots looked correct.
- Reproduction: inspect the computed rules for the mobile admin shell in `src/components/admin/admin.module.css`; `.root`, `.layout`, and `.sidebar` had only `100vh`, and the sidebar had fixed padding. This violated the confirmed dynamic-viewport/safe-area mobile requirement.
- Root cause: the storefront had already adopted `100dvh` and safe-area utilities, but the independent admin CSS module retained its older fixed viewport declarations.
- Files changed: `src/components/admin/admin.module.css`, `e2e/responsive.spec.ts`.
- Fix implemented: retained `100vh` as a compatibility fallback, added `100dvh` to the root/layout/sidebar, and added physical left/right plus top/bottom `env(safe-area-inset-*)` padding so both LTR and RTL drawers respect cutouts.
- Tests added/updated: authenticated mobile-admin drawer test asserts drawer height against `visualViewport`, no document overflow, active body scroll lock, Escape dismissal, and exact overflow restoration.
- Verification: the new regression passed in raw Chromium, iPhone 13 WebKit, and standard Android Chromium; the complete supported responsive cases total 26 applicable passes and 37 project-specific skips across the 26 raw dimensions and predefined device/tablet projects.
- Migration impact: none.
- Remaining risk: no physical handset was connected; real Safari/Chrome notch, rotation, toolbar, and keyboard checks remain a release step.

### AUD-BUG-003 — Cart concurrency regression test could create an unresolved mock request

- Severity: Low
- Description: `npm.cmd run test:coverage` intermittently failed the cart synchronization race test even though the application merge behavior passed at normal speed.
- Reproduction: run coverage instrumentation. The test could call the optional resolver before the mocked initial `/api/cart` request had started, leaving the later request unresolved until the assertion timed out.
- Root cause: the test waited for authenticated text but did not wait for the specific cart GET that established the intended “request in flight” precondition.
- Files changed: `tests/unit/store-provider-sync.test.tsx`.
- Fix implemented: wait for exactly the first cart GET and assert the resolver exists before mutating the cart and resolving the response. No application cart behavior or assertion timeout was weakened.
- Tests added/updated: the existing race regression now deterministically proves its precondition under coverage instrumentation.
- Verification: targeted instrumented test 2/2 passed; full coverage run passed 29 files / 110 tests with 44.13% statements, 39% branches, 41.42% functions, and 48.21% lines.
- Migration impact: none.
- Remaining risk: none specific; server cart authority and final-unit concurrency are also covered by PostgreSQL Playwright.

### AUD-BUG-004 — Parallel storefront projects could interrupt cold development navigations

- Severity: Low
- Description: the storefront Playwright command launched the desktop and mobile projects concurrently against one Windows Next.js development server. During the audit, two clicked destinations returned HTTP 200 but their client transitions were interrupted while independent routes cold-compiled, leaving the browsers on the prior URL.
- Reproduction: run the original `npm.cmd run test:e2e` on a cold `.next` state. The server log showed successful requests for `/en/product/p-clipper` and `/en/category/tools`, while Playwright remained on `/en/products` or `/en` and timed out.
- Root cause: project concurrency shared a development compiler/server; `fullyParallel: false` did not reduce the project worker count to one.
- Files changed: `scripts/run-e2e.ps1`.
- Fix implemented: run the storefront projects with `--workers=1`, matching the existing serial database/responsive strategy. Focused responsive grep support was also added to the owned-process runner so regression groups can finish with deterministic server teardown.
- Tests added/updated: runner behavior only; application assertions remained unchanged.
- Verification: the unchanged storefront suite reran cleanly with 20 passes and 2 intentional project-specific skips. The owned-process responsive focus rerun exited cleanly with 3/3 passes.
- Migration impact: none.
- Remaining risk: the development E2E gate is slower by design; production runtime concurrency is unaffected.

### AUD-BUG-005 — Removed product images left orphaned local files

- Severity: Medium
- Description: removing an already-saved image from a product deleted its `ProductImage` record but did not remove the corresponding file from `public/uploads`.
- Root cause: product images were replaced transactionally in PostgreSQL, while the existing `ImageStorage.remove` capability was never invoked after a successful update.
- Files changed: `src/lib/admin/mutations.ts`, `e2e/database.spec.ts`.
- Fix implemented: the transaction now returns only superseded storage keys. Those files are removed after the database commit, so a rolled-back database update cannot leave a retained image record pointing at a deleted file. Cleanup failures are logged without falsifying the committed database result.
- Verification: the real-upload browser journey saves two PNG files, verifies primary ordering, reorders them, removes each one, and polls both PostgreSQL and the filesystem for the expected state. The focused 4/4 PostgreSQL mutation run passed.
- Migration impact: none.
- Remaining risk: an upload abandoned before the product form is ever saved can still require scheduled orphan cleanup; REC-002 would normally own provider-level lifecycle policies for shared storage.

### AUD-BUG-006 — Report date filters could produce adjacent UTC buckets

- Severity: Medium
- Description: a date-only August report could contain an empty July bucket when Node ran in a positive timezone such as Asia/Hebron.
- Root cause: filter boundaries and the default range used local-time setters, while chart keys and bucket iteration used UTC setters.
- Files changed: `src/lib/reports/service.ts`, `src/lib/reports/service.test.ts`.
- Fix implemented: date-only filter boundaries, fallback range construction, and chart iteration now use consistent UTC boundaries.
- Verification: a deterministic non-UTC regression reproduces the former extra-month condition and now returns only the requested August bucket with the correct revenue.
- Migration impact: none.
- Remaining risk: none specific; date-only reports are now server-timezone independent.

## Confirmed working areas

- Authentication and routing: registration, login/logout, generic recovery, one-use reset tokens, canonical signed HttpOnly host-only sessions, database-current user/role checks, customer fallback from admin URLs, locale routing, API/framework/static proxy exclusions, relative browser API URLs, and bounded/retryable session states.
- Customer commerce: bilingual catalog/category/search/filter/sort/pagination, immutable product IDs, scheduled sale pricing, variation prices/stock, wishlist, guest/authenticated cart reconciliation, stale price/stock handling, cash delivery/pickup checkout, immutable order snapshots, order history/detail, policies, footer/header, and language switching.
- Price/inventory consistency: shared effective-price resolver, minor-unit rounding, server checkout recalculation, atomic stock writes, serializable retries, exactly-once confirm/cancel movement, no negative stock, and one winner for two concurrent customers requesting the final unit.
- Admin: role-aware entry, dashboard/navigation/mobile reachability, product create/edit/archive/restore and sales, image validation/storage metadata, categories, exact/delta inventory plus ledger, order/status/payment rules including final-order payment lock, customers, locations, content/settings, reports/charts/assistive table, five authorized injection-safe CSV exports, and print snapshots/fallbacks.
- Security: server authorization/ownership, bcrypt cost 12, signed JWT algorithm restriction and canonical encoding, production cookie flags, same-origin mutation checks in production, request-size limits, Zod parsing, generic sensitive errors, bounded process rate limiter, upload magic-byte/size/key checks, traversal-resistant generated storage keys, structured-data escaping, CSP/HSTS production headers, and CSV formula neutralization.
- Database: normalized relations and restrictive historical links, Decimal money, nonnegative/consistency SQL checks, active-cart/primary-image partial unique indexes, order/image snapshots, inventory history, reset-token indexes, sale constraints/index, repeat-safe seed policy, and no schema drift.
- Runtime/accessibility/responsive: no idle polling, bounded session/export requests, listener/timer/abort cleanup, focus-visible states, labels/error associations/live regions, modal drawer focus/scroll handling, accessible icon names/tooltips, reduced motion, chart data alternative, RTL/LTR, long-text containment, no major document overflow across the representative matrix.

## B. Recommendation decisions

The user approved REC-003 and REC-004 on 2026-08-03. Those recommendations are implemented. REC-001, REC-002, and REC-005 remain unchanged and unimplemented.

### REC-001 — Distributed rate limiting and revocable session store

- Priority: High before horizontal scaling
- Proposed change: replace process-local rate buckets and purely signed browser sessions with shared rate-limit state plus server-revocable session records.
- Current behavior: the single Node process has bounded in-memory rate limiting; signed sessions are database-revalidated and invalidated by user updates, while logout clears the host cookie.
- Why it may be better: consistent abuse limits across multiple instances and immediate revocation of an individual stolen/logout token.
- Files/modules affected: `src/lib/security/rate-limit.ts`, `src/lib/auth/session.ts`, auth routes, Prisma schema/migration, deployment configuration, auth tests.
- Risks: auth migration, extra database/cache dependency, session rollout/logouts, operational availability dependency.
- Expected benefit: stronger multi-instance security and operations.
- Migration required: yes, if database sessions are selected; possibly an external shared-cache integration.
- Safe to reject/postpone: yes while running the documented single instance; no before claiming horizontally scaled limits/revocation.

### REC-002 — Shared object-storage image adapter

- Priority: High before ephemeral or multi-instance hosting
- Proposed change: implement and test a shared object-storage/CDN adapter behind the existing `ImageStorage` interface.
- Current behavior: validated images are written to `public/uploads` and are supported on one instance only when that exact path is durable and backed up.
- Why it may be better: deploys and multiple instances would share durable assets without a mounted local volume.
- Files/modules affected: `src/lib/storage`, upload/deletion flows, environment validation, Next image configuration, deployment docs, browser upload tests.
- Risks: provider cost/credentials, deletion consistency, URL migration, cache policy, vendor dependency.
- Expected benefit: safer scalable/ephemeral deployment.
- Migration required: data migration for existing uploaded files/URLs, but not necessarily a Prisma schema migration.
- Safe to reject/postpone: yes for one instance with the documented durable volume.

### REC-003 — Dedicated category, location, and upload/reorder browser mutation journeys

- Decision: Approved and implemented.

- Priority: Medium
- Proposed change: add isolated database E2E journeys for category create/edit/archive/restore, city/area mutations, and real image upload/reorder/removal.
- Implemented behavior: the serial PostgreSQL suite now covers category create/edit/archive/restore, city/area create/edit, and real PNG upload/persist/reorder/remove, including database ordering, primary-image state, physical-file cleanup, and resilient fixture teardown.
- Why it may be better: catches future form/API integration regressions and validates storage cleanup/reordering as a browser user.
- Files/modules affected: `e2e/database.spec.ts`, `scripts/run-e2e.ps1`, `src/lib/admin/mutations.ts`, and `public/uploads` test cleanup.
- Risks: longer serial suite, filesystem fixture cleanup, more mutable database test state.
- Expected benefit: higher confidence in lower-frequency admin operations.
- Migration required: no.
- Completion evidence: focused browser run 4/4 passed; complete PostgreSQL suite 24 applicable/24 intentionally skipped passed.

### REC-004 — Raise focused unit/integration coverage for database services

- Decision: Approved and implemented.

- Priority: Medium
- Proposed change: add mocked/transactional tests and a gradual coverage threshold for cart, order, wishlist, and report services.
- Implemented behavior: 22 focused tests now exercise cart, order/inventory, wishlist, and report services. Report service code is included in instrumentation, and coverage measures 76.69% statements, 68.34% branches, 79.64% functions, and 81.41% lines with enforced floors of 70%, 60%, 70%, and 75% respectively.
- Why it may be better: faster diagnosis and tighter branch coverage for rare database-error/retry paths.
- Files/modules affected: `vitest.config.ts`, four new service test files, and the report date-boundary correction in `src/lib/reports/service.ts`.
- Risks: brittle ORM mocks or duplicate E2E assertions; added maintenance time.
- Expected benefit: faster local feedback and more explicit failure-branch documentation.
- Migration required: no.
- Completion evidence: all 33 Vitest files and 132 tests pass; every enforced coverage floor passes.

### REC-005 — Production observability integration

- Priority: Medium before public launch
- Proposed change: add an approved error/trace/metric provider with PII scrubbing, alert policy, and route-level latency/error dashboards.
- Current behavior: errors are sanitized to clients and logged generically; no third-party telemetry integration is shipped.
- Why it may be better: production-only failures and report/checkout latency become measurable without exposing secrets or customer addresses.
- Files/modules affected: Next instrumentation/error boundaries, logging wrapper, environment inventory, privacy documentation, deployment configuration.
- Risks: privacy/compliance, recurring cost, client weight if misconfigured, vendor lock-in.
- Expected benefit: faster incident detection and evidence-driven optimization.
- Migration required: no database migration expected.
- Safe to reject/postpone: yes for local/staging; an operational decision is recommended before public production.

## Verification record

| Gate | Result |
| --- | --- |
| `npx.cmd prisma validate` | Passed |
| `npx.cmd prisma generate` | Passed, Prisma Client 6.19.3 |
| `npx.cmd prisma migrate status` | Passed; 4 migrations, PostgreSQL `JYS_DB` up to date |
| `npm.cmd run lint` | Passed with zero warnings |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test` | Passed; 33 files / 132 tests |
| `npm.cmd run test:coverage` | Passed; 76.69% statements, 68.34% branches, 79.64% functions, 81.41% lines; enforced floors 70%/60%/70%/75% |
| `npm.cmd audit --audit-level=high` | Passed; 0 vulnerabilities |
| `npm.cmd run test:e2e` | Passed; 20 applicable / 2 project-specific skips |
| `npm.cmd run test:e2e:db` | Passed; 24 applicable / 24 intentional cross-project skips |
| `npm.cmd run test:e2e:hosts` | Passed; 8/8 |
| `npm.cmd run test:e2e:responsive` | Passed unfiltered; 26 applicable / 37 project-specific skips across 26 raw sizes and nine Chromium/WebKit projects |
| Opt-in Firefox | Not claimed; prior Windows Playwright attempts failed before page creation |
| Production build | Passed after REC-003/REC-004 implementation; 87 routes generated |

The first all-project responsive audit invocation exposed an incorrect accessible-name selector in the newly added drawer regression. After correcting the selector from the storefront label to the admin label, focused cross-engine runs passed and the complete unfiltered `npm.cmd run test:e2e:responsive` command then passed 26 applicable cases with 37 intentional project-specific skips in 9.6 minutes.

## Remaining external/manual blockers

1. Configure a production PostgreSQL URL, encrypted automated backups/point-in-time recovery, and a tested restore procedure.
2. Generate a production-only `AUTH_SECRET`; set matching final HTTPS `APP_URL` and `NEXT_PUBLIC_APP_URL`; configure `TRUST_PROXY` only behind a trusted header-sanitizing proxy.
3. Configure a transactional email provider, verified sender domain/address, SPF/DKIM/DMARC, and production-safe reset-message tests.
4. Mount and back up a durable writable `public/uploads` path on the documented single instance, or approve REC-002 before using ephemeral/multiple instances.
5. Replace demonstration credentials, catalog, locations, business contacts/hours, policies/legal text, branding, and imagery with approved production values.
6. Perform the documented physical-device pass on at least one current iPhone/Safari and one Android/Chrome device; Firefox/Gecko remains unverified on this Windows Playwright runner.

REC-003 and REC-004 are implemented. REC-001, REC-002, and REC-005 remain optional and unimplemented.
