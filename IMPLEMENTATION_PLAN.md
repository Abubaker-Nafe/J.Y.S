# JYS Commerce Implementation Plan — Final Status

Updated 2026-08-03 after the full repository audit. The existing application was preserved and extended; no working phase was restarted.

## Repository assessment

- Stack: Next.js 16 App Router, strict TypeScript, Tailwind CSS, Prisma 6, PostgreSQL, credentials authentication, Zod, React Hook Form, Recharts, Vitest, and Playwright.
- Runtime: Node.js 22+ on Windows; project commands use `npm.cmd` and `npx.cmd`.
- Database: local PostgreSQL database `JYS_DB` was reachable during final verification. All four committed migrations are applied, including `20260802000100_add_product_sales`.
- Hosting: no `.openai/hosting.json` exists, so this repository has no configured Sites deployment target.
- Git: all continuation work remains uncommitted, as requested. The schema change is represented by a committed-ready SQL migration file rather than an ad-hoc database edit.

## Phase status

| Phase | Final status | Verified evidence |
| --- | --- | --- |
| 1. Foundation | Complete | Locale routing, server authorization, signed HttpOnly sessions, validation, rate limits, upload checks, Prisma validation/generation, four applied migrations, repeat-safe seed |
| 2. Storefront | Complete | English/Arabic fluid layout from 320px through 480px and representative landscape/tablet/desktop widths; cross-engine mobile matrix; accessible category/mobile navigation; full-width header/footer; safe-area support; stock-revalidated catalog/cart/wishlist |
| 3. Customer and checkout | Complete | Localized database-name greeting; responsive account/address/forms; registration, persisted default address, authenticated cart/wishlist, ID-based product links, stock checks, stale-checkout rejection, fee-free delivery/pickup checkout, order history/detail, ownership and admin-denial checks |
| 4. Admin operations | Complete | Role-aware dashboard entry; desktop/mobile navigation; inventory ledger; atomic order transitions; database-current final-order payment lock; order snapshot thumbnails and print fallback; products, customers, locations, content, settings |
| 5. Reports and exports | Complete | Product-only revenue and totals; database-backed filters and metrics; five authorized UTF-8 CSV types; per-export loading, timeout, error, download, and cleanup behavior |
| 5a. Sale pricing and discovery | Complete | Database-backed normal/sale prices, price-or-percentage admin input, optional schedules, centralized effective-price resolution, on-sale discovery, cart acknowledgment, checkout revalidation, immutable order pricing, sale-aware reports/CSV, and bilingual status/error states |
| 5b. Contextual help | Complete | Reusable delayed pointer and keyboard tooltips for unclear customer/admin icon controls; one-at-a-time behavior, Escape dismissal, touch suppression, viewport clamping, and accessible descriptions |
| 6. Quality and release | Complete for repository scope | Lint, strict TypeScript, 132 unit/component/service tests, 20 storefront E2E passes, 24 applicable database/admin E2E passes, 8 localhost/custom-domain E2E passes, 26 supported Chromium/WebKit responsive E2E passes, warning-free production build |

Detailed per-requirement proof and any remaining external configuration are in [FEATURE_AUDIT.md](./FEATURE_AUDIT.md).

## Implemented continuation work

1. Added independent product and variant lifecycle/availability fields with a migration and storefront enforcement.
2. Expanded product filters and operational columns, including both languages, variants, availability, and stock state.
3. Added exact-value inventory correction and a before/delta/after administrator ledger.
4. Hardened order inventory transitions for optimistic concurrency and idempotent deduction/restoration.
5. Defined and enforced valid payment-status transitions.
6. Added customer registration date plus new, returning, and inactive classifications.
7. Expanded reports with payment filtering, delivered/collected separation, product/customer metrics, and business insights.
8. Added Orders, Sales, Products, Inventory, and Customers CSV exports with safe UTF-8/Excel handling and authorization.
9. Connected checkout policy summaries to administrator-managed database content.
10. Made repeat seeds preserve administrator-managed settings/content/catalog and operational stock/order data.
11. Added deterministic Windows Playwright runners, desktop database journeys, and mobile admin reachability checks.
12. Removed nested main landmarks and corrected standalone upload tracing so `.env`, `.git`, tests, and source files are not packaged with the upload route.
13. Upgraded vulnerable dependency patch versions and verified `npm.cmd audit` reports zero vulnerabilities.
14. Added an administrator-only storefront/account dashboard entry, role-aware post-login routing, customer fallback from admin pages, canonical session-token validation, and hydration-safe credential submission.
15. Added environment-controlled custom development origins, complete proxy exclusions, bounded session/profile requests, retryable error states, unauthenticated profile redirects, host-aware local reset links, and localhost/hosts-file browser coverage.
16. Replaced the desktop native category disclosure with an accessible hover, pointer, focus-leave, Escape, Enter, and Space interaction and retained mobile tap navigation.
17. Added `/{locale}/categories` and pointed the homepage category CTA to the complete bilingual category directory.
18. Corrected the desktop admin close-button cascade while retaining the functional mobile drawer control.
19. Made inventory adjustment selection scroll and focus the actual form, added complete bilingual Previous/Delta/New help, and retained immediate database-backed success/error refresh.
20. Reworked cart synchronization around serialized operations, mutation revisions, in-flight ordering, freshness-gated focus refreshes, guest snapshots, and no idle polling.
21. Added cart and checkout stock revalidation on load, focus/visibility return, quantity changes, pre-navigation, pre-submit synchronization, and the final serializable order transaction.
22. Added serializable-transaction retries and atomic conditional inventory writes so concurrent final-unit confirmation has one winner, repeated confirmation/cancellation is idempotent, and stock never becomes negative.
23. Revalidated wishlist snapshots on open and focus while retaining out-of-stock products and disabling Add to Cart.
24. Replaced report navigation links with bounded client downloads that have per-button loading state, duplicate prevention, abort/timeout handling, errors, and guaranteed cleanup.
25. Removed `Product.slug` from schema, migration, seed, validation, APIs, forms, types, search, and links; storefront product routes now use immutable `Product.id` in Arabic and English.
26. Made the payment-status control select the persisted current value, disable unchanged and duplicate saves, update immediately, survive refresh/revalidation, and recover cleanly from failures.
27. Removed delivery-price calculation and presentation from active checkout, location administration, orders, print, reports, and CSV; new orders store zero in the compatibility field and `total = subtotal`.
28. Added localized order-item image alt snapshots and admin/print thumbnails with purchase-time, legacy-current-image, and placeholder fallback behavior.
29. Locked payment-status editing after delivery or cancellation in both the admin UI and an atomic database-current server transaction; stale pages and direct API calls receive a conflict response without changing the stored value.
30. Added a localized authenticated-customer greeting from the trimmed session/database name, with blank-name suppression and clean long-name/email wrapping in LTR and RTL.
31. Rebuilt the customer shell around shrinkable grids, full-width safe-area containers, content-driven mobile layouts, 44px controls, bounded menus/toasts, dynamic viewport units, and responsive account/address/footer/header behavior without model-specific CSS.
32. Added DOM-geometry, overflow-offender, footer-edge, header-control, menu/dialog, text-scaling, long-content, portrait/landscape, English/Arabic, and mandatory Chromium/WebKit Playwright coverage across the complete requested viewport matrix and representative devices, with an opt-in Firefox project for capable runners.
33. Added normal-price, canonical sale-price, enablement, optional start/end dates, update timestamp, database constraints, and indexed sale lookup fields through `20260802000100_add_product_sales`.
34. Centralized integer-minor-unit sale validation, deterministic percentage rounding, schedule status, effective-price selection, and the documented variation rule in `src/lib/domain/pricing.ts`; every server and UI consumer uses this resolver.
35. Added bilingual admin sale creation/editing, price-or-percentage input, live preview, current status, filters, list columns, direct-request validation, cache revalidation, and repeat-safe sample sale seeding that preserves administrator changes.
36. Added bilingual `/{locale}/on-sale` discovery, homepage/navigation/footer promotion, badges and semantic original/final prices, variant-aware product detail, cart/wishlist propagation, explicit price-change acknowledgment, checkout rejection of stale snapshots, and historical order price preservation.
37. Added sale-aware report/CSV fields and reusable delayed accessible tooltips, then expanded the responsive suite to 26 explicit phone/tablet dimensions plus dedicated Chromium and WebKit tablet admin coverage.
38. Removed machine-specific LAN and temporary tunnel origins from source defaults; only loopback hosts are built in and every additional development hostname/IP is validated configuration through `DEV_ALLOWED_ORIGINS`.
39. Made the admin shell use dynamic viewport height with physical safe-area padding and added cross-engine mobile drawer height, scroll-lock, Escape, and overflow regression coverage.
40. Made the cart synchronization race test wait for the mocked initial request before resolving it, so coverage instrumentation cannot turn the test into a false unresolved-request failure.
41. Serialized the shared-server storefront Playwright projects on Windows to prevent simultaneous cold route compilations from interrupting otherwise valid client navigation.
42. Implemented approved recommendation REC-003 with browser/database journeys for category create/edit/archive/restore, city/area create/edit, and real PNG upload/reorder/removal, including unique fixture cleanup.
43. Closed the image lifecycle gap exposed by REC-003: product updates remove superseded local image files only after PostgreSQL commits, avoiding both orphan files and rollback-time broken references.
44. Implemented approved recommendation REC-004 with 22 focused cart, order/inventory, wishlist, and report service tests covering ownership, stale prices, availability, optimistic conflicts, serializable retries, idempotency, aggregation, and filter construction.
45. Expanded coverage instrumentation to the report service and added a first non-regression floor of 70% statements, 60% branches, 70% functions, and 75% lines. The measured baseline is materially above every floor.
46. Corrected the report timezone defect exposed by the new tests: date-only filters, fallback ranges, and chart buckets now share UTC boundaries, preventing adjacent-day/month buckets on non-UTC servers.

## Final verification gates

Passed on 2026-08-03:

- `npx.cmd prisma validate`
- `npx.cmd prisma generate`
- `npx.cmd prisma migrate status`
- `npx.cmd prisma migrate dev`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run test:e2e`
- `npm.cmd run test:e2e:db`
- `npm.cmd run test:e2e:hosts`
- `npm.cmd run test:e2e:responsive`
- `npm.cmd run build`

Latest counts: 33 Vitest files / 132 unit, component, and service tests; storefront Playwright 20 passed and 2 intentionally project-skipped; PostgreSQL/admin Playwright 24 applicable passes across 23 serial desktop workflows and one mobile reachability workflow (with 24 cross-project duplicates intentionally skipped); localhost/custom-domain Playwright 8 passed; the complete unfiltered responsive command passed 26 applicable tests with 37 intentionally project-specific skips across nine Chromium/WebKit projects. The opt-in Firefox project was attempted separately but this Windows runner failed inside Playwright before a page could be created.

## External/manual release boundaries

- Configure production PostgreSQL, backups, HTTPS URLs, and a production-only `AUTH_SECRET`.
- Configure and verify a transactional email provider; the console adapter is development-only.
- Mount and back up `public/uploads` on a durable writable volume for the shipped single-instance local-storage adapter, or implement a tested shared `ImageStorage` adapter before horizontal scaling.
- Replace sample business data, policies, credentials, delivery coverage, contact details, and temporary brand/product assets with approved production values.
