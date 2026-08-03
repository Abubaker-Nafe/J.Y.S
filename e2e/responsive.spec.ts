import { expect, test, type Page, type TestInfo } from "@playwright/test";

const rawViewports = [
  { width: 320, height: 568, label: "portrait-320x568" },
  { width: 360, height: 640, label: "portrait-360x640" },
  { width: 360, height: 800, label: "portrait-360x800" },
  { width: 375, height: 667, label: "portrait-375x667" },
  { width: 375, height: 812, label: "portrait-375x812" },
  { width: 390, height: 844, label: "portrait-390x844" },
  { width: 393, height: 852, label: "portrait-393x852" },
  { width: 412, height: 915, label: "portrait-412x915" },
  { width: 414, height: 896, label: "portrait-414x896" },
  { width: 428, height: 926, label: "portrait-428x926" },
  { width: 430, height: 932, label: "portrait-430x932" },
  { width: 480, height: 960, label: "portrait-480x960" },
  { width: 568, height: 320, label: "landscape-568x320" },
  { width: 640, height: 360, label: "landscape-640x360" },
  { width: 667, height: 375, label: "landscape-667x375" },
  { width: 812, height: 375, label: "landscape-812x375" },
  { width: 844, height: 390, label: "landscape-844x390" },
  { width: 896, height: 414, label: "landscape-896x414" },
  { width: 915, height: 412, label: "landscape-915x412" },
  { width: 932, height: 430, label: "landscape-932x430" },
  { width: 600, height: 960, label: "tablet-portrait-600x960" },
  { width: 768, height: 1024, label: "tablet-portrait-768x1024" },
  { width: 800, height: 1280, label: "tablet-portrait-800x1280" },
  { width: 820, height: 1180, label: "tablet-portrait-820x1180" },
  { width: 1024, height: 1366, label: "tablet-portrait-1024x1366" },
  { width: 1024, height: 768, label: "tablet-landscape-1024x768" },
] as const;

const customerRoutes = [
  "/en/categories",
  "/ar/on-sale",
  "/ar/products",
  "/en/search?q=clipper",
  "/ar/product/p-clipper",
  "/en/wishlist",
  "/ar/cart",
  "/en/checkout",
  "/ar/login",
  "/en/register",
  "/ar/forgot-password",
  "/en/reset-password?token=invalid",
  "/ar/profile",
  "/en/profile/addresses",
  "/ar/profile/orders",
  "/en/delivery",
  "/ar/pickup",
  "/en/privacy",
  "/ar/terms",
  "/en/no-returns",
  "/ar/warranty",
] as const;

const longName = "Nafe Abubaker with a deliberately long customer account name";
const longEmail = "customer.with.an.unusually.long.mobile.email.address@example.test";

async function mockAuthenticatedCustomer(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user: { id: "responsive-customer", name: longName, email: longEmail, role: "CUSTOMER" } }),
  }));
  await page.route("**/api/account/profile", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ profile: { id: "responsive-customer", name: longName, email: longEmail, phone: "+970597778888", customerProfile: { preferredLocale: "en" } } }),
  }));
  await page.route("**/api/account/addresses", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ addresses: [{ id: "address-long", label: "A very long saved address label that must wrap", recipientName: longName, phone: "+970597778888", cityId: "city_ramallah", areaId: "area_ramallah_centre", addressLine: "A very long delivery address with building, floor, entrance, landmark, and additional directions that must remain within the card", locationDetails: "Opposite a landmark with a deliberately long description", isDefault: true, city: { nameAr: "رام الله والبيرة", nameEn: "Ramallah & Al-Bireh" }, area: { nameAr: "وسط البلد", nameEn: "City Centre" } }] }),
  }));
  await page.route("**/api/account/orders", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ orders: [{ id: "responsive-order", orderNumber: "JYS-20260801-RESPONSIVE-LONG", status: "NEW", paymentStatus: "PENDING", fulfillmentMethod: "DELIVERY", total: "289.00", currency: "ILS", createdAt: "2026-08-01T12:00:00.000Z", _count: { items: 3 } }] }),
  }));
  await page.route("**/api/cart", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cart: { items: [], currency: "ILS", issues: [] } }) }));
  await page.route("**/api/wishlist", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
}

async function gotoReady(page: Page, url: string) {
  let reached = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "load" });
      reached = true;
      break;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("interrupted by another navigation") || attempt === 2) throw error;
      await page.waitForLoadState("load").catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }
  expect(reached, `Navigation did not settle at ${url}`).toBe(true);
  await expect(page).toHaveURL((current) => `${current.pathname}${current.search}` === url);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });
  await page.waitForLoadState("load");
}

async function expectNoDocumentOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || rect.width === 0 || rect.height === 0) return [];
      if (rect.left >= -1 && rect.right <= clientWidth + 1) return [];
      return [{ tag: element.tagName.toLowerCase(), className: element.className.toString().slice(0, 120), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
    }).slice(0, 8);
    return { clientWidth, scrollWidth: root.scrollWidth, bodyScrollWidth: document.body.scrollWidth, offenders };
  });
  expect(geometry.scrollWidth, `${label}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.bodyScrollWidth, `${label}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
}

async function expectShellGeometry(page: Page, label: string) {
  await expectNoDocumentOverflow(page, label);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  const footerBox = await footer.boundingBox();
  expect(footerBox, `${label}: footer missing`).not.toBeNull();
  expect(footerBox!.x, `${label}: footer left edge`).toBeLessThanOrEqual(1);
  expect(footerBox!.x + footerBox!.width, `${label}: footer right edge`).toBeGreaterThanOrEqual(viewportWidth - 1);
  for (const control of await page.locator("header a:visible, header summary:visible").all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.x, `${label}: header control left`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${label}: header control right`).toBeLessThanOrEqual(viewportWidth + 1);
  }
}

async function exerciseMobileMenu(page: Page, label: string) {
  const menu = page.getByRole("button", { name: /menu|القائمة/i });
  if (!await menu.isVisible().catch(() => false)) return;
  const bodyOverflowBefore = await page.evaluate(() => getComputedStyle(document.body).overflow);
  await menu.click();
  await expect(page.getByRole("searchbox").last()).toBeVisible();
  await expectNoDocumentOverflow(page, `${label}-menu-open`);
  await menu.click();
  await expect(page.getByRole("searchbox").last()).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(bodyOverflowBefore);
}

test.describe("responsive customer storefront", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedCustomer(page);
  });

  test("covers the complete explicit portrait and landscape matrix", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "chromium-raw-matrix", "The explicit dimension matrix runs once in Chromium.");
    for (const [index, viewport] of rawViewports.entries()) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const locale = index % 2 === 0 ? "en" : "ar";
      await gotoReady(page, `/${locale}`);
      await expectShellGeometry(page, `${viewport.label}-${locale}-home`);
      const route = customerRoutes[index % customerRoutes.length]!;
      await gotoReady(page, route);
      await expectShellGeometry(page, `${viewport.label}-${route}`);
      if ([0, 5, 11, 16].includes(index)) {
        await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-${locale}.png`), fullPage: true });
      }
    }
  });

  test("keeps major pages and mobile navigation contained on predefined devices", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-raw-matrix", "Predefined-device coverage runs in the device projects.");
    const locale = testInfo.project.name.includes("large") || testInfo.project.name.includes("firefox") ? "ar" : "en";
    for (const route of [`/${locale}`, `/${locale}/products`, `/${locale}/on-sale`, `/${locale}/product/p-clipper`, `/${locale}/login`, `/${locale}/privacy`]) {
      await gotoReady(page, route);
      await expectShellGeometry(page, `${testInfo.project.name}-${route}`);
    }
    await gotoReady(page, `/${locale}`);
    await exerciseMobileMenu(page, `${testInfo.project.name}-${locale}`);
  });

  test("keeps greeting, account actions, addresses, forms, and long content usable", async ({ page }, testInfo) => {
    const locale = testInfo.project.name.includes("large") || testInfo.project.name.includes("firefox") ? "ar" : "en";
    await gotoReady(page, `/${locale}/profile/addresses`);
    await expect(page.getByText(locale === "ar" ? `مرحباً ${longName}` : `Hi ${longName}`, { exact: true })).toBeVisible();
    await expect(page.getByText(longEmail, { exact: true })).toBeVisible();
    const accountNav = page.getByRole("navigation", { name: locale === "ar" ? "حسابي" : "My account" });
    await expect(accountNav).toBeVisible();
    for (const action of await accountNav.locator("a, button").all()) await expect(action).toBeVisible();
    const addAddress = page.getByRole("button", { name: locale === "ar" ? "إضافة عنوان" : "Add address" });
    await expect(addAddress).toBeVisible();
    await expectShellGeometry(page, `${testInfo.project.name}-${locale}-addresses`);
    await addAddress.click();
    await expect(page.getByLabel(locale === "ar" ? "اسم العنوان" : "Address label")).toBeVisible();
    const inputFontSize = await page.getByLabel(locale === "ar" ? "اسم العنوان" : "Address label").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(inputFontSize).toBeGreaterThanOrEqual(16);
    await expectShellGeometry(page, `${testInfo.project.name}-${locale}-address-form`);
  });

  test("survives increased text size without document overflow", async ({ page }, testInfo) => {
    test.skip(!["chromium-raw-matrix", "ios-standard-webkit", "mobile-firefox"].includes(testInfo.project.name), "Text scaling runs once per engine.");
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/en/profile/addresses");
    await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    await expectShellGeometry(page, `${testInfo.project.name}-scaled-text`);
  });

  test("shows one delayed, keyboard-accessible tooltip without affecting page width", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-raw-matrix", "Tooltip timing and focus behavior run once in Chromium.");
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/en");
    const header = page.locator("header");
    const wishlist = header.getByRole("link", { name: "Wishlist" });
    await wishlist.hover();
    await page.waitForTimeout(900);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.waitForTimeout(200);
    await expect(page.getByRole("tooltip")).toHaveText("Wishlist");
    await header.getByRole("link", { name: "My account" }).focus();
    await page.waitForTimeout(150);
    await expect(page.getByRole("tooltip")).toHaveCount(1);
    await expect(page.getByRole("tooltip")).toHaveText("My account");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expectNoDocumentOverflow(page, "tooltip-open-close");
  });
});

test.describe("responsive administrator", () => {
  test("keeps the mobile drawer inside the dynamic viewport and restores scrolling", async ({ page }, testInfo) => {
    test.skip(!["chromium-raw-matrix", "ios-standard-webkit", "android-standard-chromium"].includes(testInfo.project.name), "Admin phone coverage runs once per supported mobile engine category.");
    await page.setViewportSize({ width: 390, height: 568 });
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jys.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
    await page.goto(`/en/login?next=${encodeURIComponent("/en/admin")}`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((url) => url.pathname === "/en/admin");
    const originalOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Admin navigation" });
    await expect(drawer).toBeVisible();
    const geometry = await drawer.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
    }));
    expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.bodyOverflow).toBe("hidden");
    await expectNoDocumentOverflow(page, `${testInfo.project.name}-admin-drawer`);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(originalOverflow);
  });

  test("keeps sale product, order, and report workflows contained in Chromium and WebKit tablets", async ({ page }, testInfo) => {
    test.skip(!["tablet-chromium", "tablet-webkit"].includes(testInfo.project.name), "Admin tablet coverage runs in Chromium and WebKit.");
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jys.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
    await page.goto(`/en/login?next=${encodeURIComponent("/en/admin/products")}`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email address").fill(adminEmail);
    await page.getByLabel("Password", { exact: true }).fill(adminPassword);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((url) => url.pathname === "/en/admin/products");
    for (const route of ["/en/admin/products", "/en/admin/products/new", "/en/admin/orders", "/en/admin/reports"]) {
      await gotoReady(page, route);
      await expectNoDocumentOverflow(page, `${testInfo.project.name}-${route}`);
    }
    await expect(page.getByRole("heading", { name: "Reports & analytics" })).toBeVisible();
  });
});
