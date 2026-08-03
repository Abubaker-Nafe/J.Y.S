# Playwright E2E suites

`storefront.spec.ts` uses the intentional development demo catalogue and does not need PostgreSQL. It covers responsive browsing, filtering, search, sorting, pagination, variation stock limits, quantity changes, cart persistence, wishlist persistence, language switching, RTL, and the mobile menu.

`database.spec.ts` is deliberately skipped unless `E2E_DATABASE_READY=true`. It expects a dedicated database that has received the committed migrations and `prisma/seed.ts`, plus the same `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` values used by the running Next.js server. Its admin coverage includes category lifecycle, city/area mutations, and real PNG upload, primary-image ordering, reordering, removal, and physical-file cleanup.

For reproducible unique customer emails, set `E2E_RUN_ID` to a new letters-and-digits identifier for each prepared database run. Without it, the suite derives a per-process timestamp identifier. The database suite is serial and runs only in the desktop Chromium project.

The suite archives its created product, reverses its manual inventory adjustment, cancels the delivery order after confirming it (restoring deducted inventory), cancels the pickup order, deletes its unreferenced category/city/area fixtures, and removes its uploaded files even after a failed assertion. Customer and order rows are intentionally retained because the application provides no destructive customer/order API and treats order history as immutable. Run the suite against a disposable seeded database and reset/reseed it between repeated CI jobs when complete row-level cleanup is required. `E2E_DATABASE_GREP` can focus a group while retaining the owned-server lifecycle; `E2E_DATABASE_PROJECTS` can restrict the project list.
