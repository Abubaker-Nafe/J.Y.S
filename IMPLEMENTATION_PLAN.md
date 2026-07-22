# JYS Commerce Implementation Plan

## Repository assessment

- Existing functionality: none; the workspace contains only Git metadata.
- Existing framework/dependencies/configuration: none.
- Runtime discovered: Node.js 22.20.0 and npm 11.4.2 are available through `node`, `npm.cmd`, and `npx.cmd`.
- Database runtime discovered: Docker is not installed. The application will be PostgreSQL-ready and all connection, migration, and seed commands will be documented; database-dependent verification requires a user-supplied `DATABASE_URL`.

## Architecture

- Next.js App Router modular monolith with strict TypeScript and Tailwind CSS.
- Locale-prefixed Arabic/English storefront and admin UI, with server-selected `dir` and a remembered locale cookie.
- PostgreSQL + Prisma with normalized commerce, content, location, inventory, analytics, and audit entities.
- Secure credentials authentication using hashed passwords, opaque database sessions, HttpOnly cookies, role checks, expiring reset tokens, and rate limiting.
- Zod-validated server actions/route handlers; transactional order and inventory services.
- Replaceable email and image-storage adapters. The shipped local image driver requires a persistent mounted volume and a single application instance outside development.
- Vitest domain/integration tests and Playwright critical-flow tests.

## Existing functionality

- None.

## Missing functionality

- Project tooling, design system, localization, authentication, database, and deterministic seed data.
- Storefront catalog, product detail, search/filtering, cart, wishlist, checkout, account, orders, and policies.
- Admin dashboard, catalog/location/inventory/order/customer/content/settings management, reports, exports, and image upload.
- Security controls, validation, responsive/RTL/accessibility states, documentation, and automated verification.

## Database changes

- Add users, profiles, sessions, addresses, password reset tokens, cities, and areas.
- Add categories, products, images, variants, carts/items, wishlists, and product views.
- Add orders/items/status history, inventory adjustments, settings/content, and audit logs.
- Use decimal money, constrained enums, indexes, uniqueness rules, archive timestamps, immutable order snapshots, and transactional stock accounting.
- Add an initial migration and deterministic bilingual seed script.

## Pages and APIs

### Public/customer pages

- Home, products, category, search, product details, cart, wishlist, checkout, confirmation.
- Login, registration, forgot/reset password, profile, addresses, order history/detail.
- Terms, privacy, no-return, warranty, delivery, pickup, not-found, and error UI.

### Admin pages

- Dashboard, products/create/edit, categories, inventory, orders/detail, customers, locations, reports, content, and settings.

### Server endpoints/actions

- Auth/session/password reset; cart/wishlist; checkout/order access; catalog/search/views.
- Admin catalog, inventory, orders/payment, customers, locations, content/settings, uploads, reports, and CSV export.

## Implementation phases

1. Foundation: configs, Prisma schema/migration/seed, auth/RBAC, localization, shared layout/design system.
2. Storefront: catalog discovery, product details/variants, wishlist, persistent cart.
3. Checkout/orders: addresses, fees/pickup, policy acceptance, transactional checkout, status tracking, mail abstraction.
4. Admin: dashboard and CRUD/management modules with protected server operations.
5. Reports: database-backed summaries, charts, insights, filters, and CSV exports.
6. Quality: security/accessibility/RTL/mobile review, unit/integration/E2E tests, lint/type/build, README and setup checklist.

## Verification gates

- Run lint, strict type-checking, unit/integration tests, Playwright critical flows, and production build.
- Validate Prisma schema and generate the client without requiring a live database.
- Run migration and seed only when a reachable PostgreSQL `DATABASE_URL` exists.
- Perform a separate senior product/UI/accessibility review and repair identified weaknesses before handoff.

## Assumptions

- Default currency is ILS; cash is the only payment method.
- Product deletion is archival; historical order snapshots remain immutable.
- Local email previews and local uploads are development adapters only.
- The supplied placeholder catalog artwork is original project-owned generated imagery and can be replaced later.
