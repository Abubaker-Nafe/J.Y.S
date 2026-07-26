import { expect, test, type Page } from "@playwright/test";

const databaseReady = process.env.E2E_DATABASE_READY === "true";
const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "customer@jys.local";
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "ChangeMe-Customer-2026!";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jys.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
const origins = ["http://localhost:3000", "http://jys.com:3000"] as const;

async function login(page: Page, origin: string, locale: "ar" | "en", email: string, password: string, destination: string) {
  await page.goto(`${origin}/${locale}/login?next=${encodeURIComponent(destination)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(locale === "ar" ? "البريد الإلكتروني" : "Email address").fill(email);
  await page.getByLabel(locale === "ar" ? "كلمة المرور" : "Password", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (response) => response.url() === `${origin}/api/auth/login` && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: locale === "ar" ? "متابعة" : "Continue" }).click();
  expect((await loginResponse).status()).toBe(200);
  await page.waitForURL(`${origin}${destination}`);
}

test.describe("localhost and hosts-file authentication origins", () => {
  test.skip(!databaseReady, "Run through npm.cmd run test:e2e:hosts with the seeded local PostgreSQL database.");

  for (const { origin, locale } of [
    { origin: origins[0], locale: "en" as const },
    { origin: origins[1], locale: "ar" as const },
  ]) {
    test(`redirects an unauthenticated ${locale} profile on ${origin}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${origin}/${locale}/profile`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((url) => url.origin === origin && url.pathname === `/${locale}/login`);
      expect(new URL(page.url()).searchParams.get("next")).toBe(`/${locale}/profile`);
      await context.close();
    });

    test(`loads an authenticated ${locale} profile on ${origin}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, origin, locale, customerEmail, customerPassword, `/${locale}/profile`);
      await expect(page.locator("#profile-email")).toHaveValue(customerEmail);
      await expect(page.getByRole("status")).toHaveCount(0);
      await context.close();
    });
  }

  test("shows a retryable error when the session request fails", async ({ page }) => {
    await page.route("**/api/auth/session", (route) => route.abort("failed"));
    await page.goto(`${origins[1]}/en/profile`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("alert").filter({ hasText: "We couldn’t verify your session" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page).toHaveURL(`${origins[1]}/en/profile`);
  });

  test("serves JSON APIs and development assets without locale interception", async ({ page }) => {
    const failedRequests: string[] = [];
    const consoleErrors: string[] = [];
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    const sessionResponse = await page.request.get(`${origins[1]}/api/auth/session`, {
      headers: { Accept: "application/json" },
    });
    expect(sessionResponse.status()).toBe(200);
    expect(sessionResponse.headers()["content-type"]).toContain("application/json");
    expect(await sessionResponse.json()).toEqual({ user: null });

    const pageResponse = await page.goto(`${origins[1]}/en`, { waitUntil: "networkidle" });
    expect(pageResponse?.status()).toBe(200);
    const scriptSource = await page.locator('script[src^="/_next/"]').first().getAttribute("src");
    expect(scriptSource).toBeTruthy();
    const assetResponse = await page.request.get(`${origins[1]}${scriptSource}`);
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toMatch(/javascript|text\/plain/);
    expect(failedRequests.filter((url) => url.includes("/_next/") || url.includes("/api/"))).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("hydrates related public account and commerce routes on both hosts", async ({ page }) => {
    for (const origin of origins) {
      for (const route of [
        "/en/login",
        "/ar/register",
        "/en/forgot-password",
        "/ar/reset-password",
        "/en/wishlist",
        "/ar/cart",
        "/en/checkout",
      ]) {
        const response = await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
        expect(response?.status(), `${origin}${route}`).toBe(200);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator('script[src^="/_next/"]').first()).toHaveCount(1);
      }
    }
  });

  test("supports admin login and logout on the custom local host", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, origins[1], "en", adminEmail, adminPassword, "/en/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(`${origins[1]}/en/login`);
    const session = await page.request.get(`${origins[1]}/api/auth/session`);
    expect(await session.json()).toEqual({ user: null });
    await context.close();
  });
});
