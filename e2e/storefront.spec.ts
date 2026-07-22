import { expect, test, type Page } from "@playwright/test";

async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
}

async function reloadHydrated(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
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
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
  });

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

  test("enforces variation stock as quantity changes and persists the cart locally", async ({ page }) => {
    await gotoHydrated(page, "/en/product/forge-pro-clipper");

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
    await page.getByRole("link", { name: "Cart, 3" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
    await expect(page.getByText("Steel silver", { exact: true })).toBeVisible();
    await expect(page.locator("output")).toHaveText("3");

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

    await mobileMenu.getByRole("link", { name: "Shop all", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products$/);

    await page.getByLabel("Open menu").click();
    mobileMenu = page.locator("header details[open]");
    const mobileSearch = mobileMenu.locator("#mobile-search");
    await mobileSearch.fill("clay");
    await mobileSearch.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=clay$/);
    await expect(page.getByRole("heading", { name: "Matte Clay Pomade" })).toBeVisible();
  });
});
