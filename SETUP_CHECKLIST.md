# JYS Manual Configuration and Handover Checklist

This file is the authoritative checklist for configuring JYS after cloning and before production. Put real secrets only in `.env` or the deployment platform's encrypted environment-variable UI. Never place them in Git, screenshots, tickets, or this document.

## Required immediately for persistent local operation

1. Copy `.env.example` to `.env`.
2. Set a reachable PostgreSQL `DATABASE_URL`.
3. Generate and set a unique `AUTH_SECRET`.
4. Confirm `APP_URL` and `NEXT_PUBLIC_APP_URL` are `http://localhost:3000`.
5. Generate Prisma Client, run the migration, and seed the development database.

The marketing/catalog shell can build without contacting PostgreSQL, but registration, login, persistent carts/wishlists, checkout, orders, admin operations, and database reports require these items.

## Database

### Connection

- File: `.env` (created locally from `.env.example`)
- Variable: `DATABASE_URL`
- Required: yes for persistent application operation; local and production
- Format: `postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME?schema=public`
- Safe local example: `postgresql://jys:jys_local_change_me@localhost:5432/jys?schema=public`
- Controls: Prisma's PostgreSQL connection for every persistent feature.
- Obtain it from: your local PostgreSQL administrator, Docker Compose values, or the dashboard of a hosted PostgreSQL provider.
- Can the application run without it: only the database-independent build, domain tests, and demo-safe catalog UI; not the full commerce workflow.

For a local PostgreSQL installation, create a database and restricted application user, then use `localhost` and its configured port. Do not use a PostgreSQL superuser in production.

For Docker Desktop, `docker-compose.yml` defines the development database:

```powershell
docker compose up -d postgres
docker compose ps
```

For hosted PostgreSQL, copy the provider's direct/server connection string. Prisma migrations need a connection that allows schema DDL. If the provider supplies separate pooled and direct URLs, use the direct URL for migrations and follow that provider's Prisma instructions.

Real credentials belong in `.env` locally or encrypted deployment settings in production. `.env` is ignored because a leaked database URL can expose customer, order, address, and inventory data.

### Database commands

Run from the repository root:

```powershell
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate dev
npm.cmd run db:seed
npx.cmd prisma studio
```

- Test connectivity: `npx.cmd prisma migrate status`
- Create/apply a local migration after schema changes: `npx.cmd prisma migrate dev --name describe_change`
- Apply committed migrations in production: `npx.cmd prisma migrate deploy`
- Generate Prisma Client: `npx.cmd prisma generate`
- Seed development: `npm.cmd run db:seed`
- Inspect data locally: `npx.cmd prisma studio` (do not expose Studio publicly)

The development seed is deterministic on an empty database and conservative on repeat runs. Existing product/variant stock and availability, product lifecycle state, seeded orders (including payment and fulfillment status), and inventory-ledger entries are preserved. Use the admin inventory and order workflows for operational changes; do not rerun the seed expecting it to reset a used database.

## Authentication

### Authentication secret

- File: `.env`
- Variable: `AUTH_SECRET`
- Required: yes; local and production
- Format: Base64URL random string representing at least 32 random bytes
- Safe example shape: `m3lNEfYqT8XvPz6uN7kG0aA1fR9cD4wH2jLsB5eQxI0` (example only; do not reuse)
- Controls: cryptographic protection for authentication/session-sensitive values.
- Obtain it by generating locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- Can the full application run without it: no. A development catalog may render, but secure authentication must fail closed.
- Production action: use a different value from local, store it in the platform secret manager, and rotate it through a planned logout window.

### Application URL

- File: `.env`
- Variables: `APP_URL`, `NEXT_PUBLIC_APP_URL`
- Required: yes; local and production
- Local format/value: `http://localhost:3000`
- Production format/value: `https://shop.example.com`
- Controls: absolute server links, reset-email links, metadata, and public navigation origins.
- Obtain it from: the final deployment domain.
- Callback/reset URL: the reset page is `${APP_URL}/en/reset-password` or `${APP_URL}/ar/reset-password`; update the base URL after deployment.
- Production action: HTTPS is mandatory; do not leave either variable pointing to localhost.

Authentication cookies are HttpOnly, same-site, and secure in production. If the application is behind a trusted reverse proxy, set `TRUST_PROXY="true"` only after the proxy is correctly stripping untrusted forwarded headers.

## Administrator account

- Seed file: `prisma/seed.ts`
- Environment variables: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- Required: for development seed; production administrators should be created through a controlled one-time operation.
- Safe development values in `.env.example`: `admin@jys.local` / `ChangeMe-Admin-2026!`
- Controls: credentials hashed into the seeded admin `User` with the `ADMIN` role.
- Expected email: normalized valid email address.
- Expected password: at least 12 characters with upper/lowercase, number, and symbol.
- Obtain real value from: the designated business administrator; transmit the initial password through a secure channel.

Change all four admin/customer seed credential variables in `.env` before the first production-like `npm.cmd run db:seed`. The seed fails with a clear error if the documented emails or passwords are used when `NODE_ENV=production` or `APP_URL` is an HTTPS origin.

Changing `.env` or `prisma/seed.ts` does **not** automatically change an existing seed user. Repeat seeds preserve that user's password, role, and active/disabled status. For an existing local database, either use the protected admin account-management process or generate a new bcrypt hash in a controlled maintenance script and update only that user's `passwordHash`. Never paste a plaintext password into SQL or Prisma Studio. Revoke the user's sessions after a credential/role change.

Customer seed variables are `SEED_CUSTOMER_EMAIL` and `SEED_CUSTOMER_PASSWORD` and follow the same rules.

## Email service

The adapter lives in `src/lib/email`. Development defaults to a safe console preview; production must use a real provider before password reset is offered to customers.

| Variable | Required? | Format / safe example | Purpose |
| --- | --- | --- | --- |
| `EMAIL_PROVIDER` | Yes in production | `console` locally; `resend` in production | Selects the adapter |
| `EMAIL_FROM_NAME` | Yes in production | `JYS` | Visible sender name |
| `EMAIL_FROM_ADDRESS` | Yes in production | `orders@shop.example.com` | Verified sender address |
| `RESEND_API_KEY` | Only for Resend | `re_example_placeholder` | Provider API credential |

- File for values: `.env`; both local and production.
- Obtain sender/domain verification and API key from: the chosen email provider's dashboard.
- Without provider locally: the adapter logs a development-only safe preview/reset link to the server terminal. Forgot-password responses remain generic and do not disclose whether an account exists.
- Before production: verify the sender domain, set SPF/DKIM/DMARC, configure the real adapter, and test reset/order messages. Never log raw reset tokens in production.

## Image storage

The replaceable adapter is in `src/lib/storage`.

### Local development

- File: `.env`
- `IMAGE_STORAGE_DRIVER="local"`
- `MAX_IMAGE_SIZE_MB="5"`
- Required: driver and directory for local admin upload tests.
- Writable folder: `public/uploads`; generated upload contents are ignored by Git.
- Controls: validated product-image destination and maximum accepted file size.

Local filesystem upload is not suitable on an ephemeral/serverless production host because deploys and instance replacement can delete files and multiple instances do not share the directory.

### Production storage

The only shipped driver is `local`. For production, mount the exact `public/uploads` path on a persistent writable volume, include it in backups, and use a single application instance. Ephemeral/serverless filesystems are not supported by this release.

`src/lib/storage/types.ts` defines the replaceable `ImageStorage` interface. A future multi-instance or object-storage deployment must implement, test, and register a shared adapter before selecting another driver; this repository does not claim an S3 driver that it does not contain.

## Website and business settings

These values are database-managed and should be changed through **Admin → Settings**, **Admin → Locations**, or **Admin → Content** after signing in as an administrator.

| Setting | Admin location | Stored as | Code/environment change? |
| --- | --- | --- | --- |
| Shop name | Admin → Settings → Identity | site setting | No |
| Shop location | Admin → Settings → Pickup | site setting | No |
| Opening hours | Admin → Settings → Pickup | bilingual site setting | No |
| Phone number | Admin → Settings → Contact | site setting | No |
| Contact email | Admin → Settings → Contact | site setting | No |
| Currency | Admin → Settings → Commerce | ISO 4217 code; default `ILS` | No; no conversion |
| Delivery fees | Admin → Locations | decimal per city/area | No |
| Supported cities/areas | Admin → Locations | active bilingual records | No |
| Default low-stock threshold | Admin → Settings → Inventory | positive integer | No |
| Terms | Admin → Content → Terms | Arabic and English rich text/plain content | No |
| No-return policy | Admin → Content → No return | Arabic and English content | No |
| Warranty policy | Admin → Content → Warranty | Arabic and English content | No |
| Privacy policy | Admin → Content → Privacy | Arabic and English content | No |
| Delivery/pickup information | Admin → Content | Arabic and English content | No |
| Homepage hero copy | Admin → Settings → Homepage promotion | Arabic and English title/body | No |

Environment variables configure infrastructure and secrets, not normal business content. A code change is needed only to add a new setting type/module or a new locale. Missing Arabic/English values safely fall back to the other stored language; the site never machine-translates at runtime.

## Branding

| Asset | Exact location | How to replace |
| --- | --- | --- |
| Temporary text JYS logo | `src/components/storefront/brand-mark.tsx` and admin shell branding | Replace the mark component while preserving accessible name and light/dark contrast |
| Favicon/app icon | `src/app/icon.svg` | Replace with an original square SVG; keep the same path |
| Theme colors | `src/app/globals.css` under `:root` and `@theme inline` | Change centralized tokens, then run contrast and RTL/mobile review |
| Typography | `src/app/globals.css` variables `--font-sans`, `--font-display` | Prefer locally hosted licensed font files; avoid a runtime dependency on public font CDNs |
| Default product images | `public/images/products/` plus product image records in admin/seed | Upload through Admin → Products or replace safe seed paths |
| Homepage hero/promotional image | `public/images/jys-hero.png` and Admin → Settings → Homepage promotion | Upload/replace with licensed imagery and update alt/copy metadata |
| Page metadata | `src/app/layout.tsx` | Update title template, description, and Open Graph defaults |
| Social-sharing image | `src/app/layout.tsx` metadata and `public/images/jys-hero.png` | Point metadata to a dedicated licensed 1200×630 image if supplied |

Generated development images are original placeholders without third-party trademarks. Verify final artwork rights before public launch.

## Deployment checklist

### Required production environment

- `DATABASE_URL`: production PostgreSQL, never local credentials.
- `AUTH_SECRET`: new production-only random secret.
- `APP_URL` and `NEXT_PUBLIC_APP_URL`: final HTTPS origin.
- `EMAIL_PROVIDER`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, provider key: verified production mail.
- `IMAGE_STORAGE_DRIVER=local` plus a durable volume mounted at `public/uploads`.
- `TRUST_PROXY`: `true` only for a correctly configured trusted proxy.
- `LOG_LEVEL`: normally `info`; ensure logs exclude passwords, tokens, cookies, and sensitive address data.

Do not use `SEED_*_PASSWORD` defaults in production. Do not expose Prisma Studio, source maps containing secrets, `.env`, database ports, or upload credentials publicly.

### Build and migrate

```powershell
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run start
```

- Recommended structure for this release: one Node.js 22 service running the standalone Next.js build, managed PostgreSQL, a persistent upload volume, and a transactional email provider.
- Domain: configure DNS, set both URL variables, and add the final HTTPS origin to provider settings.
- HTTPS: mandatory for production cookies and personal/order data. Redirect HTTP to HTTPS at the trusted edge.
- Persistent storage: required for the shipped upload adapter; ephemeral/serverless files are unsupported.
- Migrations: run `npx.cmd prisma migrate deploy` once per release before shifting traffic. Back up first for destructive migrations.
- Backups: enable encrypted automated PostgreSQL backups with retention and point-in-time recovery where available. Back up the persistent upload volume separately and perform restoration drills.
- Files/folders never committed: `.env`, `.env.*` except `.env.example`, `node_modules`, `.next`, `coverage`, Playwright outputs, and `public/uploads/*`.

## Optional integrations

- Resend or an equivalent mail provider: optional locally, required for production recovery/confirmation mail.
- Shared object storage/CDN: a future extension requiring a new `ImageStorage` adapter; not included in this release.
- Docker Desktop: optional convenience for local PostgreSQL.
- Hosted PostgreSQL: optional alternative to a local server; required only if you do not operate PostgreSQL yourself.

No payment gateway, delivery-company API, analytics tracker, WhatsApp integration, or social-sales integration is required or supported in this MVP.

## Final handover table

| Item | Exact location | Required? | Current development value | What I must change | When to change it |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL URL | `.env` → `DATABASE_URL` | Immediately for persistence | Safe placeholder in `.env.example` | Replace username/password/host/database with a reachable PostgreSQL connection | Before migration/local use and production |
| Auth secret | `.env` → `AUTH_SECRET` | Immediately for auth | Unsafe placeholder | Generate at least 32 random bytes; use a separate production value | Before local auth; again before production |
| Server application URL | `.env` → `APP_URL` | Yes | `http://localhost:3000` | Set final `https://` origin | At deployment |
| Public application URL | `.env` → `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Set the same final public origin | At deployment/build |
| Admin email | `.env` → `SEED_ADMIN_EMAIL`; `prisma/seed.ts` | Development seed | `admin@jys.local` | Set designated administrator email | Before first seed; never use default in production |
| Admin password | `.env` → `SEED_ADMIN_PASSWORD`; `prisma/seed.ts` | Development seed | Public example password | Set a strong unique initial password and rotate securely | Before first seed/production onboarding |
| Customer seed | `.env` → `SEED_CUSTOMER_*` | Optional | Public example credentials | Change or omit for production | Before production seed |
| Email adapter | `.env` → `EMAIL_PROVIDER` | Production | `console` | Set real provider and verify implementation/domain | Before enabling production recovery |
| Email sender | `.env` → `EMAIL_FROM_*` | Production | Example sender | Set verified name/address | Before production email |
| Email API key | encrypted environment → `RESEND_API_KEY` | If Resend used | Empty | Add provider-issued secret | Before production email |
| Image driver | `.env` → `IMAGE_STORAGE_DRIVER` | Yes | `local` | Keep `local`; mount and back up `public/uploads` | Before deployment |
| Upload directory | `public/uploads` | For local/persistent adapter | Fixed project-local path | Mount this exact path as a writable persistent volume if the local driver remains | Before deployment |
| Upload size | `.env` → `MAX_IMAGE_SIZE_MB` | Yes | `5` | Confirm operational limit | Before launch |
| Shop details | Admin → Settings | Yes | Seeded examples | Enter real location, hours, phone, email | Before customer launch |
| Currency | Admin → Settings → Commerce | Yes | `ILS` | Confirm; no currency conversion exists | Before pricing products |
| Cities/areas/fees | Admin → Locations | Yes for delivery | Seeded Palestinian examples | Verify coverage, activation, and exact fees | Before taking delivery orders |
| Policies | Admin → Content | Yes | Bilingual example policies | Obtain business/legal review and publish approved Arabic/English text | Before customer launch |
| Product/catalog data | Admin → Products/Categories | Yes | Demonstration data | Replace with real SKU, stock, prices, variants, copy, and images | Before customer launch |
| Temporary logo | `src/components/storefront/brand-mark.tsx` | Optional replacement | Text `JYS` | Replace with final accessible brand mark | When brand assets are approved |
| Favicon | `src/app/icon.svg` | Optional replacement | Temporary monogram | Replace with final original SVG | When brand assets are approved |
| Colors/type | `src/app/globals.css` | Optional replacement | Neutral JYS system | Apply final brand tokens and re-test contrast/RTL | When brand identity is approved |
| Hero/product art | `public/images` and product records | Optional replacement | Original generated placeholders | Replace with licensed final photography and accurate alt text | Before marketing launch |
| Proxy trust | `.env` → `TRUST_PROXY` | Deployment-specific | `false` | Enable only behind a correctly configured trusted proxy | At infrastructure setup |
| Logs | `.env` → `LOG_LEVEL` | Operational | `info` | Connect secure collection/retention without PII leakage | Before production |
| Database backups | PostgreSQL provider/operations | Production | Not configured by repository | Enable encrypted automated backups and test restore | Before launch |

## Final verification

After configuration, run:

```powershell
npx.cmd prisma migrate status
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Then verify both `/en` and `/ar`, registration/login, cart stock limits, wishlist persistence, delivery and pickup checkout, ownership-protected order detail, admin denial for customers, product creation, inventory correction, order confirmation/cancellation stock behavior, policy editing, reports, CSV export, mobile navigation, keyboard focus, and print order output.
