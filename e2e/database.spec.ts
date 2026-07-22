import { expect, test, type APIResponse, type Page, type Response } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const databaseReady = process.env.E2E_DATABASE_READY === "true";
const baseURL = "http://127.0.0.1:3000";
const configuredRunId = process.env.E2E_RUN_ID;
const generatedRunId = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}${process.pid}`;
const runId = (configuredRunId ?? generatedRunId).replace(/[^a-zA-Z0-9]/g, "").slice(-24).toLowerCase() || "local";
const customerPassword = "E2E-Customer-2026!";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jys.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Admin-2026!";
const prisma = new PrismaClient();

let customerEmail = "";
let customerPhone = "";
let deliveryOrderId = "";
let deliveryOrderNumber = "";
let pickupOrderId = "";
let pickupOrderNumber = "";
let createdProductId = "";

type JsonObject = Record<string, unknown>;
type JsonResponse = APIResponse | Response;

function stablePhone(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) % 10_000_000;
  return `056${String(hash).padStart(7, "0")}`;
}

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

async function responseJson(response: JsonResponse): Promise<JsonObject> {
  return response.json().catch(() => ({})) as Promise<JsonObject>;
}

async function expectResponse(response: JsonResponse, status: number) {
  const payload = await responseJson(response);
  expect(response.status(), JSON.stringify(payload)).toBe(status);
  return payload;
}

async function inventoryStock(page: Page, sku: string) {
  const response = await page.request.get(`/api/admin/inventory?search=${encodeURIComponent(sku)}`);
  const payload = await expectResponse(response, 200);
  const rows = payload.data as Array<{ sku?: string; stock?: number }> | undefined;
  const row = rows?.find((item) => item.sku === sku);
  expect(row, `Missing admin inventory row for ${sku}`).toBeDefined();
  return row?.stock ?? Number.NaN;
}

async function login(page: Page, email: string, password: string, next = "/en/profile") {
  await gotoHydrated(page, `/en/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expectResponse(await responsePromise, 200);
  const expected = new URL(next, baseURL);
  await page.waitForURL((url) => url.pathname === expected.pathname && url.search === expected.search);
}

async function loginCustomer(page: Page, next = "/en/profile") {
  await login(page, customerEmail, customerPassword, next);
}

async function loginAdmin(page: Page, next = "/en/admin") {
  await login(page, adminEmail, adminPassword, next);
}

async function addProductToCart(page: Page, slug: string, productName: string) {
  await gotoHydrated(page, `/en/product/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/cart") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expectResponse(await responsePromise, 201);
}

test.describe("seeded PostgreSQL customer and admin journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!databaseReady, "Set E2E_DATABASE_READY=true only after migrating and seeding a disposable PostgreSQL test database.");

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "State-changing database journeys run once in the desktop Chromium project.");
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (!databaseReady || testInfo.project.name !== "chromium" || (!createdProductId && !pickupOrderId)) return;

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await loginAdmin(page);

      if (pickupOrderId) {
        const order = await page.request.get(`/api/admin/orders/${pickupOrderId}`);
        if (order.ok()) {
          const current = await responseJson(order);
          const data = current.data as { status?: string } | undefined;
          if (data?.status === "NEW") {
            const cancelled = await page.request.patch(`/api/admin/orders/${pickupOrderId}`, {
              data: { status: "CANCELLED", note: `E2E ${runId} cleanup` },
            });
            expect(cancelled.ok(), JSON.stringify(await responseJson(cancelled))).toBeTruthy();
          }
        }
      }

      if (createdProductId) {
        const archived = await page.request.delete(`/api/admin/products/${createdProductId}`);
        expect(archived.ok(), JSON.stringify(await responseJson(archived))).toBeTruthy();
      }
    } finally {
      await context.close();
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("registers a customer with a unique email and persisted default address", async ({ page }, testInfo) => {
    customerEmail = `e2e.customer.${runId}.${testInfo.retry}@example.com`;
    customerPhone = stablePhone(`${runId}-${testInfo.retry}`);

    await gotoHydrated(page, "/en/register");
    await page.getByLabel("Full name").fill(`E2E Customer ${runId}`);
    await page.getByLabel("Phone number").fill(customerPhone);
    await page.getByLabel("Email address").fill(customerEmail);
    await page.getByLabel("City").selectOption({ label: "Ramallah & Al-Bireh" });
    await page.getByLabel("Default address").fill(`E2E Street ${runId}, Building 12`);
    await page.getByLabel("Password", { exact: true }).fill(customerPassword);
    await page.getByLabel("Confirm password").fill(customerPassword);

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    const payload = await expectResponse(await responsePromise, 201);
    expect((payload.user as { email?: string } | undefined)?.email).toBe(customerEmail);

    await page.waitForURL((url) => url.pathname === "/en/profile");
    await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
    await expect(page.getByText(customerEmail, { exact: true })).toBeVisible();

    const addresses = await page.request.get("/api/account/addresses");
    const addressPayload = await expectResponse(addresses, 200);
    expect((addressPayload.addresses as unknown[] | undefined)?.length).toBe(1);
  });

  test("logs in and synchronizes the authenticated cart and wishlist with PostgreSQL", async ({ page }) => {
    await loginCustomer(page);
    await expect(page.getByText(customerEmail, { exact: true })).toBeVisible();

    await addProductToCart(page, "matte-styling-clay", "Matte Styling Clay");

    const details = page.locator("section").filter({
      has: page.getByRole("heading", { level: 1, name: "Matte Styling Clay" }),
    });
    const wishlistPromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/wishlist") && response.request().method() === "POST",
    );
    await details.getByRole("button", { name: "Save" }).click();
    await expectResponse(await wishlistPromise, 201);

    const persistedWishlist = await page.request.get("/api/wishlist");
    const wishlistPayload = await expectResponse(persistedWishlist, 200);
    const wishlistItems = wishlistPayload.items as Array<{ product?: { slug?: string } }> | undefined;
    expect(wishlistItems?.some((item) => item.product?.slug === "matte-styling-clay")).toBeTruthy();

    await page.evaluate(() => {
      window.localStorage.removeItem("jys.cart.v1");
      window.localStorage.removeItem("jys.wishlist.v1");
    });
    await reloadHydrated(page);
    await expect(page.getByRole("link", { name: "Cart, 1" })).toBeVisible();

    const persistedCart = await page.request.get("/api/cart");
    const cartPayload = await expectResponse(persistedCart, 200);
    const cart = cartPayload.cart as { items?: Array<{ product?: { slug?: string }; quantity?: number }> } | undefined;
    expect(cart?.items?.some((item) => item.product?.slug === "matte-styling-clay" && item.quantity === 1)).toBeTruthy();
  });

  test("places a delivery cash order with a database delivery fee", async ({ page }) => {
    await loginCustomer(page, "/en/checkout");
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();

    await page.getByLabel("Full name").fill(`E2E Customer ${runId}`);
    await page.getByLabel("Phone number").fill(customerPhone);
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByLabel("Area").selectOption({ index: 1 });
    await page.getByLabel("Full address").fill(`E2E Delivery Street ${runId}, Building 12`);
    await page.getByLabel("Location description (optional)").fill("Opposite the test pharmacy");

    const placeOrder = page.getByRole("button", { name: "Place cash order" });
    await expect(placeOrder).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(placeOrder).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/checkout") && response.request().method() === "POST",
    );
    await placeOrder.click();
    const payload = await expectResponse(await responsePromise, 201);
    const order = payload.order as { id?: string; orderNumber?: string } | undefined;
    deliveryOrderId = order?.id ?? "";
    deliveryOrderNumber = order?.orderNumber ?? "";
    expect(deliveryOrderId).not.toBe("");
    expect(deliveryOrderNumber).toMatch(/^JYS-\d{8}-[A-F0-9]{6}$/);

    await expect(page).toHaveURL(new RegExp(`/en/order-confirmation/${deliveryOrderNumber.replaceAll("-", "\\-")}\\?id=`));
    await expect(page.getByText(deliveryOrderNumber, { exact: true })).toBeVisible();
    await expect(page.getByText("Order received", { exact: true })).toBeVisible();

    const persisted = await page.request.get(`/api/account/orders/${deliveryOrderId}`);
    const persistedPayload = await expectResponse(persisted, 200);
    const persistedOrder = persistedPayload.order as { fulfillmentMethod?: string; deliveryFee?: string; addressLine?: string | null } | undefined;
    expect(persistedOrder?.fulfillmentMethod).toBe("DELIVERY");
    expect(Number(persistedOrder?.deliveryFee)).toBeGreaterThan(0);
    expect(persistedOrder?.addressLine).toContain(`E2E Delivery Street ${runId}`);
  });

  test("places a pickup cash order without a delivery address or fee", async ({ page }) => {
    await loginCustomer(page);
    await addProductToCart(page, "complete-shaving-set", "Complete Shaving Set");
    await gotoHydrated(page, "/en/checkout");

    await page.getByRole("radio", { name: /Store pickup/ }).check();
    await expect(page.getByLabel("Full address")).toHaveCount(0);
    await expect(page.getByText("Cash on collection", { exact: true })).toBeVisible();
    await page.getByLabel("Full name").fill(`E2E Customer ${runId}`);
    await page.getByLabel("Phone number").fill(customerPhone);
    await page.getByRole("checkbox").check();

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/checkout") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Place cash order" }).click();
    const payload = await expectResponse(await responsePromise, 201);
    const order = payload.order as { id?: string; orderNumber?: string } | undefined;
    pickupOrderId = order?.id ?? "";
    pickupOrderNumber = order?.orderNumber ?? "";
    expect(pickupOrderId).not.toBe("");
    expect(pickupOrderNumber).toMatch(/^JYS-\d{8}-[A-F0-9]{6}$/);

    await expect(page.getByText(pickupOrderNumber, { exact: true })).toBeVisible();
    await expect(page.getByText("Order received", { exact: true })).toBeVisible();

    const persisted = await page.request.get(`/api/account/orders/${pickupOrderId}`);
    const persistedPayload = await expectResponse(persisted, 200);
    const persistedOrder = persistedPayload.order as { fulfillmentMethod?: string; deliveryFee?: string; addressLine?: string | null } | undefined;
    expect(persistedOrder?.fulfillmentMethod).toBe("PICKUP");
    expect(persistedOrder?.deliveryFee).toBe("0.00");
    expect(persistedOrder?.addressLine).toBeNull();
  });

  test("shows the customer's order history and owned order detail", async ({ page }) => {
    await loginCustomer(page, "/en/profile/orders");
    await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
    await expect(page.getByText(deliveryOrderNumber, { exact: true })).toBeVisible();
    await expect(page.getByText(pickupOrderNumber, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(deliveryOrderNumber) }).click();
    await expect(page).toHaveURL(new RegExp(`/en/profile/orders/${deliveryOrderId}$`));
    await expect(page.getByText(deliveryOrderNumber, { exact: true })).toBeVisible();
    await expect(page.getByText("Delivery", { exact: true })).toBeVisible();

    const history = await page.request.get("/api/account/orders");
    const historyPayload = await expectResponse(history, 200);
    const items = historyPayload.orders as Array<{ id?: string; orderNumber?: string }> | undefined;
    expect(items?.some((item) => item.id === deliveryOrderId && item.orderNumber === deliveryOrderNumber)).toBeTruthy();

    const detail = await page.request.get(`/api/account/orders/${deliveryOrderId}`);
    const detailPayload = await expectResponse(detail, 200);
    expect((detailPayload.order as { orderNumber?: string } | undefined)?.orderNumber).toBe(deliveryOrderNumber);
  });

  test("denies the customer access to the protected admin area", async ({ page }) => {
    await loginCustomer(page);
    await page.goto("/en/admin");

    await expect(page).toHaveURL(/\/en\/login\?next=/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByText("JYS Administration", { exact: true })).toHaveCount(0);
  });

  test("allows a seeded administrator to create a bilingual product", async ({ page }) => {
    await loginAdmin(page, "/en/admin/products/new");
    const productName = `E2E Inventory Product ${runId}`;
    const sku = `E2E-${runId.slice(-12).toUpperCase()}`;
    const slug = `e2e-inventory-${runId}`;

    await page.getByLabel("English name").fill(productName);
    await page.getByLabel("الاسم بالعربية").fill(`منتج اختبار ${runId}`);
    await page.getByLabel("SKU", { exact: true }).fill(sku);
    await page.getByLabel("URL slug").fill(slug);
    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByLabel("Base price").fill("25.50");
    await page.getByLabel("Base product stock").fill("11");
    await page.getByLabel("Low-stock threshold").fill("3");
    await page.getByLabel("English description").fill("A real product created by the seeded PostgreSQL E2E suite.");
    await page.getByLabel("الوصف بالعربية").fill("منتج حقيقي أنشأه اختبار قاعدة البيانات.");

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/products") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const payload = await expectResponse(await responsePromise, 201);
    createdProductId = (payload.data as { id?: string } | undefined)?.id ?? "";
    expect(createdProductId).not.toBe("");

    await page.waitForURL((url) => url.pathname === `/en/admin/products/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
    await expect(page.getByText(sku, { exact: false })).toBeVisible();
  });

  test("confirms the delivery order and then cancels it to restore inventory", async ({ page }) => {
    await loginAdmin(page, `/en/admin/orders?search=${encodeURIComponent(deliveryOrderNumber)}`);

    const orderInventory = await prisma.order.findUnique({
      where: { id: deliveryOrderId },
      select: { items: { select: { productId: true, skuSnapshot: true, quantity: true } } },
    });
    const line = orderInventory?.items[0];
    if (!line?.productId) throw new Error("Delivery order did not retain a product inventory reference");
    const stockBefore = await prisma.product.findUnique({ where: { id: line.productId }, select: { stockQuantity: true } });
    if (!stockBefore) throw new Error("Delivery order product was not found");
    expect(await inventoryStock(page, line.skuSnapshot)).toBe(stockBefore.stockQuantity);
    expect(await prisma.inventoryAdjustment.count({ where: { orderId: deliveryOrderId } })).toBe(0);

    const orderRow = page.getByRole("row").filter({ hasText: deliveryOrderNumber });
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Order ${deliveryOrderNumber}` })).toBeVisible();

    await page.getByLabel("Next status").selectOption("CONFIRMED");
    await page.getByLabel("Internal note (optional)").fill(`Confirmed by E2E ${runId}`);
    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/orders/${deliveryOrderId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Update order status" }).click();
    await expectResponse(await responsePromise, 200);
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();

    const expectedDeductedStock = stockBefore.stockQuantity - line.quantity;
    expect(await inventoryStock(page, line.skuSnapshot)).toBe(expectedDeductedStock);
    expect((await prisma.product.findUnique({ where: { id: line.productId }, select: { stockQuantity: true } }))?.stockQuantity).toBe(expectedDeductedStock);
    expect(await prisma.inventoryAdjustment.findMany({ where: { orderId: deliveryOrderId }, select: { type: true, quantityDelta: true } })).toEqual([
      { type: "ORDER_DEDUCTION", quantityDelta: -line.quantity },
    ]);

    const duplicateConfirmation = await page.request.patch(`/api/admin/orders/${deliveryOrderId}`, {
      data: { status: "CONFIRMED", note: `Duplicate confirmation probe ${runId}` },
    });
    await expectResponse(duplicateConfirmation, 200);
    expect(await inventoryStock(page, line.skuSnapshot)).toBe(expectedDeductedStock);
    expect(await prisma.inventoryAdjustment.count({ where: { orderId: deliveryOrderId, type: "ORDER_DEDUCTION" } })).toBe(1);

    await page.getByLabel("Next status").selectOption("CANCELLED");
    await page.getByLabel("Internal note (optional)").fill(`Cancelled after verification by E2E ${runId}`);
    page.once("dialog", (dialog) => dialog.accept());
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/orders/${deliveryOrderId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Update order status" }).click();
    await expectResponse(await responsePromise, 200);
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status history" }).locator("xpath=ancestor::section")).toContainText("Confirmed");

    expect(await inventoryStock(page, line.skuSnapshot)).toBe(stockBefore.stockQuantity);
    expect((await prisma.product.findUnique({ where: { id: line.productId }, select: { stockQuantity: true } }))?.stockQuantity).toBe(stockBefore.stockQuantity);
    expect(await prisma.inventoryAdjustment.findMany({ where: { orderId: deliveryOrderId }, orderBy: { createdAt: "asc" }, select: { type: true, quantityDelta: true } })).toEqual([
      { type: "ORDER_DEDUCTION", quantityDelta: -line.quantity },
      { type: "ORDER_RESTORATION", quantityDelta: line.quantity },
    ]);

    const duplicateCancellation = await page.request.patch(`/api/admin/orders/${deliveryOrderId}`, {
      data: { status: "CANCELLED", note: `Duplicate cancellation probe ${runId}` },
    });
    await expectResponse(duplicateCancellation, 200);
    expect(await inventoryStock(page, line.skuSnapshot)).toBe(stockBefore.stockQuantity);
    expect(await prisma.inventoryAdjustment.count({ where: { orderId: deliveryOrderId, type: "ORDER_RESTORATION" } })).toBe(1);
  });

  test("adjusts the created product inventory and reverses the correction", async ({ page }) => {
    const sku = `E2E-${runId.slice(-12).toUpperCase()}`;
    await loginAdmin(page, `/en/admin/inventory?search=${encodeURIComponent(sku)}`);

    let row = page.getByRole("row").filter({ hasText: sku });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(3)).toHaveText("11");
    await row.getByRole("button", { name: "Adjust stock" }).click();
    await page.getByLabel("Quantity change").fill("3");
    await page.getByLabel("Reason").fill(`E2E ${runId} stock verification`);

    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/inventory") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expectResponse(await responsePromise, 200);
    row = page.getByRole("row").filter({ hasText: sku });
    await expect(row.getByRole("cell").nth(3)).toHaveText("14");

    await row.getByRole("button", { name: "Adjust stock" }).click();
    await page.getByLabel("Quantity change").fill("-3");
    await page.getByLabel("Reason").fill(`E2E ${runId} cleanup reversal`);
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/inventory") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expectResponse(await responsePromise, 200);
    await expect(page.getByRole("row").filter({ hasText: sku }).getByRole("cell").nth(3)).toHaveText("11");
  });
});
