import { expect, test, type Page } from "@playwright/test";

async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });
  await page.waitForLoadState("load");
}

async function reloadHydrated(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });
  await page.waitForLoadState("load");
}

async function revealCatalogFilters(page: Page) {
  if (await page.getByRole("searchbox", { name: "Search by product name" }).count()) return;

  await page
    .locator("main details > summary")
    .filter({ hasText: "Filters" })
    .click();
  await expect(page.getByRole("searchbox", { name: "Search by product name" })).toBeVisible();
}

async function revealLanguageSwitcher(page: Page, locale: "ar" | "en") {
  const switcher = page.locator(`a[hreflang="${locale}"]:visible`);
  if (await switcher.count()) return switcher;

  await page.getByLabel("Open menu").click();
  await expect(switcher).toBeVisible();
  return switcher;
}

test.describe("database-free demo storefront", () => {
  test("browses, searches, filters, sorts, and paginates the demo catalogue", async ({ page }) => {
    await gotoHydrated(page, "/en/products");

    await expect(page.getByRole("heading", { level: 1, name: "Professional supplies" })).toBeVisible();
    await expect(page.getByText("12 products", { exact: true })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(8);

    await revealCatalogFilters(page);
    const query = page.getByRole("searchbox", { name: "Search by product name" });
    const category = page.getByRole("combobox", { name: "Category" });
    const sort = page.getByRole("combobox", { name: "Sort by" });
    const available = page.getByRole("checkbox", { name: "Available now" });

    await query.fill("beard");
    await expect(page.getByText("2 products", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cedar Beard Oil" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily Beard Balm" })).toBeVisible();

    await category.selectOption("beard-care");
    await available.check();
    await expect(page.getByText("1 products", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cedar Beard Oil" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Daily Beard Balm" })).toHaveCount(0);

    await query.fill("");
    await available.uncheck();
    await sort.selectOption("high");
    await expect(page.locator("article h2").first()).toHaveText("Cedar Beard Oil");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("12 products", { exact: true })).toBeVisible();
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  });

  test("uses immutable product IDs for cards and bilingual product routes", async ({ page }) => {
    await gotoHydrated(page, "/en/products");
    const productLink = page.getByRole("heading", { name: "Forge Pro Clipper" }).getByRole("link");
    await expect(productLink).toHaveAttribute("href", "/en/product/p-clipper");
    await productLink.click();
    await expect(page).toHaveURL(/\/en\/product\/p-clipper$/);
    await expect(page.getByRole("heading", { level: 1, name: "Forge Pro Clipper" })).toBeVisible();

    await gotoHydrated(page, "/ar/product/p-clipper");
    await expect(page.getByRole("heading", { level: 1, name: "ماكينة فورج برو" })).toBeVisible();
    await gotoHydrated(page, "/en/product/not-a-product-id");
    await expect(page.getByRole("heading", { level: 1, name: "That page is not on the shelf" })).toBeVisible();
  });

  test("enforces variation stock as quantity changes and persists the cart locally", async ({ page }) => {
    await gotoHydrated(page, "/en/product/p-clipper");

    await expect(page.getByRole("heading", { level: 1, name: "Forge Pro Clipper" })).toBeVisible();
    const silver = page.getByRole("radio", { name: /Steel silver/ });
    await page.getByRole("group", { name: "Choose an option" }).getByText("Steel silver", { exact: true }).click();
    await expect(silver).toBeChecked();

    const increase = page.getByRole("button", { name: "Increase Quantity" });
    await increase.click();
    await increase.click();
    await expect(page.locator("output")).toHaveText("3");
    await expect(increase).toBeDisabled();

    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added to cart" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cart, 3" })).toBeVisible();
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/en/cart"),
      page.getByRole("link", { name: "Cart, 3" }).click(),
    ]);

    await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    await expect(page.getByText("Steel silver", { exact: true })).toBeVisible();
    await expect(page.locator("output")).toHaveText("3");
    await expect(page.getByRole("heading", { name: "Forge Pro Clipper" }).getByRole("link")).toHaveAttribute("href", "/en/product/p-clipper");

    await page.getByRole("button", { name: "Decrease Forge Pro Clipper" }).click();
    await expect(page.locator("output")).toHaveText("2");
    await expect(page.getByRole("link", { name: "Cart, 2" })).toBeVisible();

    await reloadHydrated(page);
    await expect(page.locator("output")).toHaveText("2");
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your cart is ready for something useful" })).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "Cart", exact: true })).toBeVisible();
  });

  test("adds, persists, views, and removes a wishlist product", async ({ page }) => {
    await gotoHydrated(page, "/en/products");

    const card = page.locator("article").filter({ hasText: "Cedar Beard Oil" });
    const save = card.locator('button[aria-pressed]');
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Wishlist, 1" })).toBeVisible();

    await reloadHydrated(page);
    await expect(page.getByRole("link", { name: "Wishlist, 1" })).toBeVisible();
    await page.getByRole("link", { name: "Wishlist, 1" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Saved products" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cedar Beard Oil" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cedar Beard Oil" }).getByRole("link")).toHaveAttribute("href", "/en/product/p-oil");
    await page.locator("article").filter({ hasText: "Cedar Beard Oil" }).locator('button[aria-pressed="true"]').click();
    await expect(page.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "Wishlist", exact: true })).toBeVisible();
  });

  test("switches English to Arabic, preserves the route/query, and applies RTL", async ({ page }) => {
    await gotoHydrated(page, "/en/search?q=clipper");
    await expect(page).toHaveURL(/\/en\/search\?q=clipper$/);

    const switcher = await revealLanguageSwitcher(page, "ar");
    await switcher.click();

    await expect(page).toHaveURL(/\/ar\/search\?q=clipper$/);
    const arabicShell = page.locator('[lang="ar"][dir="rtl"]').first();
    await expect(arabicShell).toBeVisible();
    await expect(arabicShell).toHaveAttribute("dir", "rtl");

    await gotoHydrated(page, "/ar/products");
    const arabicPagination = page.getByRole("navigation", { name: "صفحات المنتجات" });
    await expect(arabicPagination.locator('span[dir="ltr"]')).toHaveText("1 / 2");

    await gotoHydrated(page, "/");
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator('[lang="ar"][dir="rtl"]').first()).toBeVisible();
  });

  test("opens the mobile menu and navigates through its links and search", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile navigation is exercised only by the mobile Playwright project.");

    await gotoHydrated(page, "/en");
    const menu = page.getByLabel("Open menu");
    await menu.click();
    let mobileMenu = page.locator("header details[open]");
    await expect(mobileMenu.locator("#mobile-search")).toBeVisible();
    await expect(mobileMenu.getByRole("link", { name: "Shop all", exact: true })).toBeVisible();
    await mobileMenu.getByRole("link", { name: "All categories", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/categories$/);
    await expect(page.getByRole("heading", { level: 1, name: "Browse categories" })).toBeVisible();

    await gotoHydrated(page, "/en");
    await page.getByLabel("Open menu").click();
    mobileMenu = page.locator("header details[open]");
    await mobileMenu.getByRole("link", { name: "Shop all", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products$/);
    await expect(page.getByRole("heading", { level: 1, name: "Professional supplies" })).toBeVisible();

    await page.getByLabel("Open menu").click();
    mobileMenu = page.locator("header details[open]");
    const mobileSearch = mobileMenu.locator("#mobile-search");
    await mobileSearch.fill("clay");
    await mobileSearch.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=clay$/);
    await expect(page.getByRole("heading", { name: "Matte Clay Pomade" })).toBeVisible();
  });

  test("opens the desktop category menu by hover and keyboard, then closes it predictably", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop hover and keyboard navigation run in desktop Chromium.");
    await gotoHydrated(page, "/en");

    const trigger = page.getByRole("button", { name: "Categories" });
    await trigger.hover();
    const menu = page.getByRole("menu", { name: "Categories" });
    await expect(menu).toBeVisible();
    await menu.hover();
    await expect(menu).toBeVisible();
    const viewport = page.viewportSize();
    await page.mouse.move(2, Math.max(2, (viewport?.height ?? 800) - 2));
    await expect(menu).toBeHidden();

    await trigger.focus();
    await trigger.press("Enter");
    await expect(menu).toBeVisible();
    await trigger.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: /Barber tools/ }).click();
    await expect(page).toHaveURL(/\/en\/category\/tools$/);
    await expect(menu).toBeHidden();

    await gotoHydrated(page, "/ar");
    const arabicTrigger = page.getByRole("button", { name: "التصنيفات" });
    await arabicTrigger.press("Space");
    await expect(page.getByRole("menu", { name: "التصنيفات" })).toBeVisible();
  });

  test("homepage category CTA opens the bilingual category index", async ({ page }) => {
    await gotoHydrated(page, "/en");
    await page.getByRole("link", { name: "Explore collection", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/categories$/);
    await expect(page.getByRole("heading", { level: 1, name: "Browse categories" })).toBeVisible();

    await gotoHydrated(page, "/ar/categories");
    await expect(page.getByRole("heading", { level: 1, name: "تصفّح التصنيفات" })).toBeVisible();
  });

  test("keeps an out-of-stock wishlist item visible and disables adding it to cart", async ({ page }) => {
    await gotoHydrated(page, "/en/search?q=Daily%20Beard%20Balm");
    const card = page.locator("article").filter({ hasText: "Daily Beard Balm" });
    await card.locator("button[aria-pressed]").click();
    await page.getByRole("link", { name: "Wishlist, 1" }).click();

    const savedCard = page.locator("article").filter({ hasText: "Daily Beard Balm" });
    await expect(savedCard).toBeVisible();
    await expect(savedCard.getByText("Out of stock")).toBeVisible();
    await expect(savedCard.getByRole("button", { name: /Add to cart/ })).toBeDisabled();
  });

  test("revalidates an authenticated cart once on return without idle polling", async ({ page }) => {
    let availableStock = 1;
    let cartGets = 0;
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "mock-user", name: "Mock Customer", email: "mock@example.com", role: "CUSTOMER" } }) });
    });
    await page.route("**/api/cart", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      cartGets += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cart: {
            currency: "ILS",
            issues: availableStock ? [] : [{ itemId: "mock-line", code: "UNAVAILABLE_OR_LOW_STOCK" }],
            items: [{
              id: "mock-line",
              productId: "mock-product",
              quantity: 1,
              unitPrice: 20,
              availableStock,
              isAvailable: availableStock > 0,
              product: { nameAr: "منتج تجريبي", nameEn: "Mock product" },
            }],
          },
        }),
      });
    });

    await gotoHydrated(page, "/en/cart");
    await expect(page.getByRole("heading", { name: "Mock product" })).toBeVisible();
    const requestsBeforeIdle = cartGets;
    expect(requestsBeforeIdle).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(700);
    expect(cartGets).toBe(requestsBeforeIdle);

    availableStock = 0;
    await page.waitForTimeout(4_100);
    const requestsBeforeFocus = cartGets;
    await expect(async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }).toPass({ timeout: 10_000 });
    await expect(page.getByText("Currently unavailable — remove this item to continue.")).toBeVisible();
    await expect(page.locator('[aria-disabled="true"]').filter({ hasText: "Checkout" })).toBeVisible();
    expect(cartGets).toBe(requestsBeforeFocus + 1);
    await page.waitForTimeout(500);
    expect(cartGets).toBe(requestsBeforeFocus + 1);
  });

  test("keeps sale pricing consistent across discovery, product, wishlist, cart, and structured data", async ({ page }) => {
    await gotoHydrated(page, "/en/on-sale");
    await expect(page.getByRole("heading", { level: 1, name: "On sale" })).toBeVisible();
    await expect(page.getByText("4 products", { exact: true })).toBeVisible();
    await expect(page.locator("main article del").first()).toBeVisible();
    await expect(page.getByText(/% off/).first()).toBeVisible();
    await revealCatalogFilters(page);
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("discount");

    await gotoHydrated(page, "/en/product/p-clipper");
    await expect(page.locator("main del").first()).toBeVisible();
    const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(structuredData ?? "{}").offers.price).toBe("231.20");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();

    await gotoHydrated(page, "/en/cart");
    await expect(page.getByRole("heading", { name: "Forge Pro Clipper" })).toBeVisible();
    await expect(page.locator("main del")).toContainText("289");
    await gotoHydrated(page, "/en/wishlist");
    await expect(page.getByRole("heading", { name: "Forge Pro Clipper" })).toBeVisible();
    await expect(page.locator("main article del")).toBeVisible();

    await gotoHydrated(page, "/ar/on-sale");
    await expect(page.locator("main article").first().getByText(/خصم/)).toBeVisible();
    await expect(page.locator("main article del").first()).toBeVisible();
  });
});
