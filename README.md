# JYS Commerce

JYS Commerce is a bilingual Arabic/English commerce platform for a Palestinian men's salon and barber-products business. It is a modular Next.js application with a PostgreSQL/Prisma data layer, credentials authentication, cash checkout, delivery and pickup fulfillment, transactional inventory, a protected admin workspace, and database-backed reporting.

The application intentionally does **not** implement appointments, online payment, guest checkout, ratings/reviews, customer return requests, warranty claims, discount codes, or delivery-company APIs.

> Before first use, follow [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md). A reachable PostgreSQL database and a secure authentication secret are required for persistent accounts, carts, checkout, and admin operations. The final senior release audit is recorded in [QUALITY_REVIEW.md](./QUALITY_REVIEW.md).

## What is included

- Arabic and English locale routes with RTL/LTR layout and a remembered language choice.
- Responsive storefront: home, a bilingual category directory plus accessible desktop/mobile category navigation, search/filter/sort, product detail, variations, database-revalidated cart/wishlist, and useful empty/error/loading states.
- Account flows: registration, login/logout, generic forgot-password response, expiring reset token, profile, addresses, and protected order history/detail.
- Cash-only delivery and pickup checkout with server-recalculated prices, area fees, stock validation, terms acceptance, immutable order snapshots, and readable order numbers.
- Inventory rules: deduct once on confirmation, restore once on cancellation, transition validation, adjustment audit trail, and concurrency-safe transactions.
- Protected admin workspace: overview, products/variants/images, categories, inventory, orders/payment/status history, customers, cities/areas/fees, reports/CSV, content, and settings.
- Original local, unbranded placeholder artwork for the hero and sample products.
- Security controls: password hashing, signed HttpOnly SameSite sessions, server authorization, Zod validation, rate limits, safe upload validation, ownership checks, generic auth recovery response, security headers, and no committed secrets.
- Prisma schema, deterministic seed data, unit/integration tests, Playwright critical-flow specifications, Docker Compose, and production standalone build configuration.

## Architecture

```text
Browser
  -> locale-aware App Router pages and client interactions
  -> validated Route Handlers / server-only admin adapters
  -> auth, catalog, order, inventory, reporting services
  -> Prisma ORM
  -> PostgreSQL
```

The system is one modular monolith. Stock, pricing, authorization, and order state transitions are server-owned. Browser cart state is helpful UI state, not a price or stock authority. Historical order items retain purchase-time names, variation labels, unit prices, quantities, address, and acceptance timestamp.

## Main folders

| Path | Purpose |
| --- | --- |
| `src/app/[locale]` | Arabic/English storefront, account, policy, and admin routes |
| `src/app/api` | Auth, account, cart, wishlist, checkout, upload, and admin endpoints |
| `src/components/storefront` | Store header, cards, filters, cart, forms, and customer feedback |
| `src/components/admin` | Admin shell, forms, tables, charts, print views, and mutation feedback |
| `src/lib/auth` | Password, sessions, password reset, and authorization |
| `src/lib/domain` | Money, cart, delivery, order-transition, and inventory rules |
| `src/lib/admin` / `src/lib/reports` | Protected admin operations and report aggregation |
| `src/lib/i18n` | Locale parsing, dictionaries, field fallback, and formatting |
| `src/lib/email` / `src/lib/storage` | Replaceable mail and image-storage adapters |
| `prisma` | Schema, SQL migration, and deterministic development seed |
| `tests` / `e2e` | Domain/integration and Playwright critical-flow tests |
| `public/images` | Temporary original brand/catalog artwork |
| `QUALITY_REVIEW.md` | Final senior product, UX, accessibility, security, and release critique |

## Database entities

The Prisma model covers users, customer profiles, addresses, password-reset tokens, cities, areas, categories, products, images, variants, wishlists, carts/items, product views, orders/items, status history, inventory adjustments, settings, content pages, and audit logs. Money uses PostgreSQL `Decimal`, critical lookups are indexed, historical records use restrictive relationships, and sellable records are archived instead of hard-deleted.

## Local setup on Windows

### 1. Install dependencies

```powershell
npm.cmd install
```

### 2. Configure the environment

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Edit `.env` and set at minimum:

```dotenv
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME?schema=public"
AUTH_SECRET="PASTE_THE_GENERATED_RANDOM_VALUE"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Start PostgreSQL

Docker is optional and was not available in the build environment. If Docker Desktop is available on your machine:

```powershell
docker compose up -d postgres
```

Then use the local development URL documented in [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md). Otherwise use an existing local or hosted PostgreSQL connection string.

### 4. Generate, migrate, and seed

```powershell
npx.cmd prisma generate
npx.cmd prisma migrate dev
npm.cmd run db:seed
```

### 5. Start the application

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`. The root redirects to the remembered locale, defaulting to English. Arabic is available at `/ar` and English at `/en`.

For the optional Windows hosts-file alias `127.0.0.1 jys.com`, set `DEV_ALLOWED_ORIGINS="jys.com"` in `.env`, restart `npm.cmd run dev`, and open `http://jys.com:3000`. Keep `APP_URL` and `NEXT_PUBLIC_APP_URL` at `http://localhost:3000` for the default local origin. Browser API requests are relative and remain on whichever host you opened; authentication cookies are intentionally host-only, so sign in separately on `localhost` and `jys.com`.

## Development credentials

The seed reads credentials from `.env`. The safe development defaults shown in `.env.example` are:

| Role | Email | Default development password |
| --- | --- | --- |
| Admin | `admin@jys.local` | `ChangeMe-Admin-2026!` |
| Customer | `customer@jys.local` | `ChangeMe-Customer-2026!` |

These are public development examples, not secrets. Change all four seed credential variables **before any production seed**. The seed refuses these defaults when `NODE_ENV=production` or `APP_URL` uses HTTPS. Re-running the seed intentionally preserves existing seed-user passwords, roles, and account status; editing the variables does not mutate an existing account. It also preserves existing product/variant stock and availability, product lifecycle state, every existing seeded order and payment state, and immutable inventory-ledger rows. Deterministic sample values are inserted only when those records do not exist. See the controlled account-update procedure in the setup checklist.

## Quality commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:coverage
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:e2e:hosts
npm.cmd run build
npm.cmd run start
```

Database commands:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd run db:studio
```

## Verified Admin Workflows

Use the seeded administrator credentials from your local `.env`. A normal administrator login now opens `/{locale}/admin` automatically, and the dashboard icon in the storefront header or **Admin dashboard** item in the account navigation returns to it later. These entries are rendered only for an authenticated `ADMIN`. An authenticated customer who manually enters an admin URL is returned to their account; unauthenticated visitors are sent to login. Replace `en` with `ar` for the Arabic/RTL admin route. All routes below are protected on the server.

| Workflow | Exact route | Verified steps |
| --- | --- | --- |
| Add a product | `/en/admin/products/new` | Open **Products** → **Add product**; enter bilingual content, SKU/slug/category/price/initial stock/states; optionally upload/reorder images or add variants; select **Save changes**. The successful database E2E redirects to the new edit route. |
| Edit a product | `/en/admin/products/[id]` | Open a row from `/en/admin/products`; edit metadata or availability; save. Existing stock is deliberately read-only here and remains ledger-owned. The E2E verifies the storefront update and unavailable 404 state. |
| Adjust stock | `/en/admin/inventory` | Search a product/variant; select **Adjust stock**; choose delta or exact value; enter a reason; save. The page refreshes current stock and shows previous/delta/new/admin/time in adjustment history. |
| Confirm an order | `/en/admin/orders/[id]` | Open an order from `/en/admin/orders`; choose **Confirmed** and save. The server validates the transition and deducts inventory once. |
| Cancel an order | `/en/admin/orders/[id]` | Choose **Cancelled** and save. If inventory was deducted, it is restored once; a repeated cancellation does not duplicate the ledger row. |
| Edit shop settings | `/en/admin/settings` | Edit identity, contact, location, hours, currency, default threshold, or homepage promotion; select **Save settings**. Public database values refresh after save. |
| Edit policies/instructions | `/en/admin/content` | Select Terms, Privacy, No-return, Warranty, Delivery, or Pickup; edit Arabic/English title and content; publish/save. Public policy pages read this record. |
| Open reports | `/en/admin/reports` | Apply date, order/payment status, fulfillment, category, and day/week/month filters; submit to refresh database-backed metrics, tables, chart data, and insights. |
| Export CSV | `/en/admin/reports` | Apply filters, then select **Export orders**, **sales**, **products**, **inventory**, or **customers**. Downloads are admin-authorized UTF-8 CSV files and retain the active filters. |

The mobile admin drawer was verified against Products, Add product, Inventory, Orders, Customers, Cities & fees, Content, Settings, and Reports. The full automated paths are in `e2e/database.spec.ts`.

## Environment variables

`.env.example` is the canonical inventory. Important groups are:

- Required for persistent operation: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`.
- Optional local hostname aliases: `DEV_ALLOWED_ORIGINS` (comma-separated hostnames only).
- Optional locally but required for production email: `EMAIL_PROVIDER`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, `RESEND_API_KEY`.
- Image adapter: `IMAGE_STORAGE_DRIVER=local` and `MAX_IMAGE_SIZE_MB`. The shipped adapter uses the fixed mountable path `public/uploads`; `ImageStorage` is the extension point for a future object-storage implementation.
- Development seed only: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`.
- Operations: `TRUST_PROXY`, `LOG_LEVEL`.

Never commit `.env`; it is intentionally ignored.

## Production

Use Node.js 22+, a managed PostgreSQL database with automated backups, HTTPS, and a persistent volume for uploaded images. Set production URLs and secrets, then run:

```powershell
npm.cmd ci
npx.cmd prisma migrate deploy
npm.cmd run build
npm.cmd run start
```

The Next.js build is configured for standalone output. Run one app process against PostgreSQL with `public/uploads` mounted on durable storage. A multi-instance deployment additionally requires a shared rate-limit store and a shared storage adapter that is not shipped in this repository. Back up both PostgreSQL and uploaded assets, and test restoration before launch.

## Documented assumptions

- ILS is the initial currency; there is no conversion. The configured code is snapshotted onto each new order, so changing it never relabels historical orders.
- Cash on delivery and cash on pickup are the only payment presentations.
- Pickup location and opening hours come from site settings.
- A cart does not reserve stock. Checkout and confirmation revalidate inside transactions.
- Revenue defaults to delivered/collected orders; reports can filter status/date.
- Console email is development-only. The `public/uploads` adapter may be used in a single-instance production deployment only when that path is mounted on durable, backed-up storage.
- Missing bilingual content falls back to the other stored language without runtime machine translation.
- Palestinian phone input is normalized to `+9705XXXXXXXX` where possible.

## Manual handover

Every value and replaceable asset is mapped in [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md), including database formats, Auth secret generation, admin credentials, email, storage, business settings, brand files, deployment, backups, and the final handover table.
