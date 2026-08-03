import { expect, test, type APIResponse, type Locator, type Page, type Response } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { access, unlink } from "node:fs/promises";
import path from "node:path";

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
let createdProductSku = "";
let createdProductName = "";
let saleTestOrderId = "";
let createdCategoryId = "";
let createdCityId = "";
let createdAreaId = "";
const uploadedImageKeys = new Set<string>();

type JsonObject = Record<string, unknown>;
type JsonResponse = APIResponse | Response;

function stablePhone(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) % 10_000_000;
  return `056${String(hash).padStart(7, "0")}`;
}

async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });
}

async function reloadHydrated(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
  await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });
}

async function responseJson(response: JsonResponse): Promise<JsonObject> {
  return response.json().catch(() => ({})) as Promise<JsonObject>;
}

async function expectResponse(response: JsonResponse, status: number) {
  const payload = await responseJson(response);
  expect(response.status(), JSON.stringify(payload)).toBe(status);
  return payload;
}

async function expectImagePath(image: Locator, expectedPath: string) {
  await expect.poll(async () => {
    const source = await image.getAttribute("src");
    return source ? new URL(source, baseURL).pathname : null;
  }).toBe(expectedPath);
}

async function uploadedFileExists(storageKey: string) {
  try {
    await access(path.join(process.cwd(), "public", "uploads", storageKey));
    return true;
  } catch {
    return false;
  }
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

async function addProductToCart(page: Page, productId: string, productName: string) {
  const initialCart = page.waitForResponse(
    (response) => response.url().endsWith("/api/cart") && response.request().method() === "GET",
  );
  await gotoHydrated(page, `/en/product/${productId}`);
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  await initialCart;
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/cart") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expectResponse(await responsePromise, 201);
}

async function expectNoDocumentOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(geometry.scrollWidth, `${label}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.bodyScrollWidth, `${label}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
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

      for (const cleanupOrderId of [pickupOrderId, saleTestOrderId].filter(Boolean)) {
        const order = await page.request.get(`/api/admin/orders/${cleanupOrderId}`);
        if (order.ok()) {
          const current = await responseJson(order);
          const data = current.data as { status?: string } | undefined;
          if (data?.status === "NEW") {
            const cancelled = await page.request.patch(`/api/admin/orders/${cleanupOrderId}`, {
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
    try {
      const imageKeys = [...uploadedImageKeys];
      if (imageKeys.length) {
        await prisma.productImage.deleteMany({ where: { storageKey: { in: imageKeys } } });
        await Promise.all(imageKeys.map((storageKey) => unlink(path.join(process.cwd(), "public", "uploads", storageKey)).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        })));
      }
      if (createdAreaId) await prisma.area.deleteMany({ where: { id: createdAreaId } });
      if (createdCityId) await prisma.city.deleteMany({ where: { id: createdCityId } });
      if (createdCategoryId) await prisma.category.deleteMany({ where: { id: createdCategoryId } });
    } finally {
      await prisma.$disconnect();
    }
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
    await expect(page.getByText(`Hi E2E Customer ${runId}`, { exact: true })).toBeVisible();
    await expect(page.getByText(customerEmail, { exact: true })).toBeVisible();

    const addresses = await page.request.get("/api/account/addresses");
    const addressPayload = await expectResponse(addresses, 200);
    expect((addressPayload.addresses as unknown[] | undefined)?.length).toBe(1);
  });

  test("logs in and synchronizes the authenticated cart and wishlist with PostgreSQL", async ({ page }) => {
    await loginCustomer(page);
    await expect(page.getByText(customerEmail, { exact: true })).toBeVisible();

    await addProductToCart(page, "product_styling_clay", "Matte Styling Clay");

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
    const wishlistItems = wishlistPayload.items as Array<{ productId?: string }> | undefined;
    expect(wishlistItems?.some((item) => item.productId === "product_styling_clay")).toBeTruthy();

    await page.evaluate(() => {
      window.localStorage.removeItem("jys.cart.v1");
      window.localStorage.removeItem("jys.wishlist.v1");
    });
    await reloadHydrated(page);
    await expect(page.getByRole("link", { name: "Cart, 1" })).toBeVisible();

    const persistedCart = await page.request.get("/api/cart");
    const cartPayload = await expectResponse(persistedCart, 200);
    const cart = cartPayload.cart as { items?: Array<{ productId?: string; quantity?: number }> } | undefined;
    expect(cart?.items?.some((item) => item.productId === "product_styling_clay" && item.quantity === 1)).toBeTruthy();
  });

  test("places a delivery order with a provider-priced notice and product-only total", async ({ page }) => {
    await loginCustomer(page, "/en/checkout");
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();

    await page.getByLabel("Full name").fill(`E2E Customer ${runId}`);
    await page.getByLabel("Phone number").fill(customerPhone);
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByLabel("Area").selectOption({ index: 1 });
    await page.getByLabel("Full address").fill(`E2E Delivery Street ${runId}, Building 12`);
    await page.getByLabel("Location description (optional)").fill("Opposite the test pharmacy");
    await expect(page.getByText("The delivery fee is determined separately by the delivery provider based on the destination.", { exact: true })).toBeVisible();
    await expect(page.locator("dt").filter({ hasText: /Delivery fee|^Delivery$/ })).toHaveCount(0);

    const ordersBeforeManipulation = await prisma.order.count({ where: { user: { email: customerEmail } } });
    const manipulated = await page.request.post("/api/checkout", { data: { fulfillmentMethod: "DELIVERY", name: `E2E Customer ${runId}`, phone: customerPhone, cityId: await page.getByLabel("City").inputValue(), areaId: await page.getByLabel("Area").inputValue(), addressLine: `E2E Delivery Street ${runId}, Building 12`, acceptPolicies: true, deliveryFee: 999 } });
    await expectResponse(manipulated, 400);
    expect(await prisma.order.count({ where: { user: { email: customerEmail } } })).toBe(ordersBeforeManipulation);

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

    await expect(page).toHaveURL(new RegExp(`/en/order-confirmation/${deliveryOrderNumber.replaceAll("-", "\\-")}\\?id=`), { timeout: 30_000 });
    await expect(page.getByText(deliveryOrderNumber, { exact: true })).toBeVisible();
    await expect(page.getByText("Order received", { exact: true })).toBeVisible();

    const persisted = await page.request.get(`/api/account/orders/${deliveryOrderId}`);
    const persistedPayload = await expectResponse(persisted, 200);
    const persistedOrder = persistedPayload.order as { fulfillmentMethod?: string; subtotal?: string; total?: string; deliveryFee?: string; addressLine?: string | null } | undefined;
    expect(persistedOrder?.fulfillmentMethod).toBe("DELIVERY");
    expect(persistedOrder?.deliveryFee).toBeUndefined();
    expect(persistedOrder?.total).toBe(persistedOrder?.subtotal);
    expect(persistedOrder?.addressLine).toContain(`E2E Delivery Street ${runId}`);
    const databaseOrder = await prisma.order.findUniqueOrThrow({ where: { id: deliveryOrderId }, select: { subtotal: true, deliveryFee: true, total: true } });
    expect(databaseOrder.deliveryFee.toFixed(2)).toBe("0.00");
    expect(databaseOrder.total.toFixed(2)).toBe(databaseOrder.subtotal.toFixed(2));
  });

  test("places a pickup cash order without a delivery address or fee", async ({ page }) => {
    await loginCustomer(page);
    await addProductToCart(page, "product_shaving_set", "Complete Shaving Set");
    await gotoHydrated(page, "/en/checkout");

    await page.locator("main").getByText("Store pickup", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Store pickup/ })).toBeChecked();
    await expect(page.getByLabel("Full address")).toHaveCount(0);
    await expect(page.locator("dt").filter({ hasText: /Delivery fee|^Delivery$/ })).toHaveCount(0);
    await expect(page.getByText("Cash on collection", { exact: true }).first()).toBeVisible();
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
    const persistedOrder = persistedPayload.order as { fulfillmentMethod?: string; subtotal?: string; total?: string; deliveryFee?: string; addressLine?: string | null } | undefined;
    expect(persistedOrder?.fulfillmentMethod).toBe("PICKUP");
    expect(persistedOrder?.deliveryFee).toBeUndefined();
    expect(persistedOrder?.total).toBe(persistedOrder?.subtotal);
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
    await expect(page.locator("main").getByRole("heading", { name: "Delivery", exact: true })).toBeVisible();

    const history = await page.request.get("/api/account/orders");
    const historyPayload = await expectResponse(history, 200);
    const items = historyPayload.orders as Array<{ id?: string; orderNumber?: string }> | undefined;
    expect(items?.some((item) => item.id === deliveryOrderId && item.orderNumber === deliveryOrderNumber)).toBeTruthy();

    const detail = await page.request.get(`/api/account/orders/${deliveryOrderId}`);
    const detailPayload = await expectResponse(detail, 200);
    expect((detailPayload.order as { orderNumber?: string } | undefined)?.orderNumber).toBe(deliveryOrderNumber);

    await gotoHydrated(page, "/ar/profile");
    await expect(page.getByText(`مرحباً E2E Customer ${runId}`, { exact: true })).toBeVisible();
  });

  test("stores purchase-time images and uses snapshot, legacy, and placeholder fallbacks", async ({ page }) => {
    const deliveryItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: deliveryOrderId }, include: { product: { include: { images: { orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }], take: 1 } } } } });
    expect(deliveryItem.imageUrlSnapshot).toBeTruthy();
    expect(deliveryItem.imageAltArSnapshot).toBe(deliveryItem.productNameAr);
    expect(deliveryItem.imageAltEnSnapshot).toBe(deliveryItem.productNameEn);
    const currentImage = deliveryItem.product?.images[0];
    if (!deliveryItem.productId || !currentImage || !deliveryItem.imageUrlSnapshot) throw new Error("Order image test prerequisites are missing");

    await loginAdmin(page, `/en/admin/orders/${deliveryOrderId}`);
    const snapshotImage = page.getByRole("img", { name: deliveryItem.imageAltEnSnapshot ?? deliveryItem.productNameEn });
    await expectImagePath(snapshotImage, deliveryItem.imageUrlSnapshot);
    try {
      await prisma.productImage.update({ where: { id: currentImage.id }, data: { url: "/images/products/clipper.png" } });
      await reloadHydrated(page);
      await expectImagePath(page.getByRole("img", { name: deliveryItem.imageAltEnSnapshot ?? deliveryItem.productNameEn }), deliveryItem.imageUrlSnapshot);
      await gotoHydrated(page, `/en/admin/orders/${deliveryOrderId}/print`);
      await expect(page.getByRole("img", { name: deliveryItem.imageAltEnSnapshot ?? deliveryItem.productNameEn })).toBeVisible();
    } finally {
      await prisma.productImage.update({ where: { id: currentImage.id }, data: { url: currentImage.url } });
    }

    const pickupItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: pickupOrderId } });
    const original = { productId: pickupItem.productId, imageUrlSnapshot: pickupItem.imageUrlSnapshot, imageAltArSnapshot: pickupItem.imageAltArSnapshot, imageAltEnSnapshot: pickupItem.imageAltEnSnapshot };
    try {
      await prisma.orderItem.update({ where: { id: pickupItem.id }, data: { imageUrlSnapshot: null, imageAltArSnapshot: null, imageAltEnSnapshot: null } });
      await gotoHydrated(page, `/en/admin/orders/${pickupOrderId}`);
      await expect(page.getByRole("img", { name: pickupItem.productNameEn })).toBeVisible();
      await prisma.orderItem.update({ where: { id: pickupItem.id }, data: { productId: null } });
      await reloadHydrated(page);
      await expect(page.getByRole("img", { name: pickupItem.productNameEn })).toContainText("JYS");
    } finally {
      await prisma.orderItem.update({ where: { id: pickupItem.id }, data: original });
    }
  });

  test("keeps the payment dropdown synchronized with the saved database value", async ({ page }) => {
    await loginAdmin(page, `/en/admin/orders/${deliveryOrderId}`);
    const paymentSelect = page.getByLabel("Cash payment status");
    const savePayment = page.getByRole("button", { name: "Save payment status" });
    await expect(paymentSelect).toHaveValue("PENDING");
    await expect(savePayment).toBeDisabled();
    await paymentSelect.selectOption("PAID");
    await expect(savePayment).toBeEnabled();
    const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/admin/orders/${deliveryOrderId}`) && response.request().method() === "PATCH");
    await savePayment.click();
    await expectResponse(await responsePromise, 200);
    await expect(paymentSelect).toHaveValue("PAID");
    await expect(savePayment).toBeDisabled();
    expect((await prisma.order.findUnique({ where: { id: deliveryOrderId }, select: { paymentStatus: true } }))?.paymentStatus).toBe("PAID");
    await reloadHydrated(page);
    await expect(page.getByLabel("Cash payment status")).toHaveValue("PAID");
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });

  test("locks payment updates for delivered and concurrently cancelled orders", async ({ page }) => {
    await loginAdmin(page, "/en/admin/orders/seed_order_delivered");
    await expect(page.getByLabel("Update order").getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Payment status cannot be changed after an order is delivered or cancelled.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Cash payment status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save payment status" })).toHaveCount(0);

    const deliveredAttempt = await page.request.patch("/api/admin/orders/seed_order_delivered", { data: { paymentStatus: "PENDING" } });
    const deliveredPayload = await expectResponse(deliveredAttempt, 409);
    expect(deliveredPayload.error).toBe("Payment status cannot be changed after an order is delivered or cancelled.");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: "seed_order_delivered" }, select: { paymentStatus: true } })).paymentStatus).toBe("PAID");

    // Keep the browser on a non-final snapshot, then finalize the order through
    // a second request before submitting the stale payment form.
    await gotoHydrated(page, `/en/admin/orders/${pickupOrderId}`);
    const stalePaymentSelect = page.getByLabel("Cash payment status");
    await expect(stalePaymentSelect).toHaveValue("PENDING");
    const cancelled = await page.request.patch(`/api/admin/orders/${pickupOrderId}`, { data: { status: "CANCELLED", note: "Concurrent E2E cancellation" } });
    await expectResponse(cancelled, 200);
    await stalePaymentSelect.selectOption("PAID");
    const stalePaymentSave = page.getByRole("button", { name: "Save payment status" });
    await expect(stalePaymentSave).toBeEnabled();
    const staleAttemptPromise = page.waitForResponse((response) => response.url().endsWith(`/api/admin/orders/${pickupOrderId}`) && response.request().method() === "PATCH");
    await stalePaymentSave.click();
    await expectResponse(await staleAttemptPromise, 409);
    await expect(page.getByLabel("Update order").getByRole("alert")).toContainText("Payment status cannot be changed after an order is delivered or cancelled.");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: pickupOrderId }, select: { status: true, paymentStatus: true } }))).toMatchObject({ status: "CANCELLED", paymentStatus: "PENDING" });

    await gotoHydrated(page, `/ar/admin/orders/${pickupOrderId}`);
    await expect(page.getByLabel("تحديث الطلب").getByText("قيد الانتظار", { exact: true })).toBeVisible();
    await expect(page.getByText("لا يمكن تغيير حالة الدفع بعد توصيل الطلب أو إلغائه.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ حالة الدفع" })).toHaveCount(0);
  });

  test("denies the customer access to the protected admin area", async ({ page }) => {
    await loginCustomer(page);
    await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);
    await page.goto("/en/admin");

    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
    await expect(page.getByText("JYS Administration", { exact: true })).toHaveCount(0);

    const reports = await page.request.get("/api/admin/reports");
    expect(reports.status()).toBe(403);
    const exports = await page.request.get("/api/admin/reports/csv?type=orders");
    expect(exports.status()).toBe(403);
    const protectedProduct = await prisma.product.findFirstOrThrow({ where: { status: "ACTIVE" }, select: { id: true } });
    const saleMutation = await page.request.patch(`/api/admin/products/${protectedProduct.id}`, { data: { saleEnabled: true, saleInputMethod: "PERCENTAGE", salePercentage: 10 } });
    expect(saleMutation.status()).toBe(403);
  });

  test("shows administrators a storefront entry point to the admin dashboard", async ({ page }) => {
    await loginAdmin(page);
    await gotoHydrated(page, "/en");

    const adminEntry = page.getByRole("link", { name: "Admin dashboard" });
    await expect(adminEntry).toBeVisible();
    await expect(adminEntry).toHaveAttribute("href", "/en/admin");
    await adminEntry.click();

    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("JYS Admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close navigation" })).toBeHidden();
  });

  test("creates, edits, archives, and restores a bilingual category", async ({ page }) => {
    await loginAdmin(page, "/en/admin/categories");
    const categoryName = `E2E Category ${runId}`;
    const editedName = `${categoryName} Edited`;
    const slug = `e2e-category-${runId}`;

    await page.getByRole("button", { name: "New category" }).click();
    await page.locator('input[name="nameAr"]').fill(`تصنيف اختبار ${runId}`);
    await page.getByLabel("English name").fill(categoryName);
    await page.getByLabel("URL slug").fill(slug);
    await page.locator('textarea[name="descriptionAr"]').fill("وصف تصنيف اختباري");
    await page.getByLabel("English description").fill("Database browser category journey.");
    await page.getByLabel("Display order").fill("77");

    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/categories") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const created = await expectResponse(await responsePromise, 201);
    createdCategoryId = (created.data as { id?: string } | undefined)?.id ?? "";
    expect(createdCategoryId).not.toBe("");

    const categoryRow = (name: string) => page.getByRole("row").filter({ hasText: name });
    await expect(categoryRow(categoryName)).toContainText("Active");
    await categoryRow(categoryName).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("English name").fill(editedName);
    await page.getByLabel("Display order").fill("78");
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/categories/${createdCategoryId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expectResponse(await responsePromise, 200);
    await expect(categoryRow(editedName)).toContainText("78");

    page.once("dialog", (dialog) => dialog.accept());
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/categories/${createdCategoryId}`) && response.request().method() === "DELETE",
    );
    await categoryRow(editedName).getByRole("button", { name: "Archive" }).click();
    await expectResponse(await responsePromise, 200);
    await expect(categoryRow(editedName)).toContainText("Archived");

    page.once("dialog", (dialog) => dialog.accept());
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/categories/${createdCategoryId}/restore`) && response.request().method() === "POST",
    );
    await categoryRow(editedName).getByRole("button", { name: "Restore" }).click();
    await expectResponse(await responsePromise, 200);
    await expect(categoryRow(editedName)).toContainText("Inactive");

    await expect.poll(async () => prisma.category.findUnique({ where: { id: createdCategoryId }, select: { nameEn: true, displayOrder: true, isActive: true, archivedAt: true } })).toEqual({
      nameEn: editedName,
      displayOrder: 78,
      isActive: false,
      archivedAt: null,
    });
  });

  test("creates and edits a delivery city and area", async ({ page }) => {
    await loginAdmin(page, "/en/admin/locations");
    const cityName = `E2E City ${runId}`;
    const editedCityName = `${cityName} Edited`;
    const areaName = `E2E Area ${runId}`;
    const editedAreaName = `${areaName} Edited`;

    await page.getByRole("button", { name: "Add city" }).click();
    await page.locator('input[name="nameAr"]').fill(`مدينة اختبار ${runId}`);
    await page.getByLabel("English name").fill(cityName);
    await page.getByLabel("Slug").fill(`e2e-city-${runId}`);
    await page.getByLabel("Display order").fill("88");
    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/locations") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const cityPayload = await expectResponse(await responsePromise, 201);
    createdCityId = (cityPayload.data as { id?: string } | undefined)?.id ?? "";
    expect(createdCityId).not.toBe("");

    const citySection = (name: string) => page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name, exact: true }) }).first();
    await expect(citySection(cityName)).toContainText("Active");
    await citySection(cityName).getByRole("button", { name: "Edit city" }).click();
    await page.getByLabel("English name").fill(editedCityName);
    await page.getByLabel("Display order").fill("89");
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/locations/${createdCityId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expectResponse(await responsePromise, 200);
    await expect(citySection(editedCityName)).toBeVisible();

    await citySection(editedCityName).getByRole("button", { name: "Area", exact: true }).click();
    await page.locator('input[name="nameAr"]').fill(`منطقة اختبار ${runId}`);
    await page.getByLabel("English name").fill(areaName);
    await page.getByLabel("Slug").fill(`e2e-area-${runId}`);
    await page.getByLabel("Display order").fill("4");
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/locations") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const areaPayload = await expectResponse(await responsePromise, 201);
    createdAreaId = (areaPayload.data as { id?: string } | undefined)?.id ?? "";
    expect(createdAreaId).not.toBe("");

    const areaRow = (name: string) => citySection(editedCityName).getByRole("row").filter({ hasText: name });
    await expect(areaRow(areaName)).toContainText("Active");
    await areaRow(areaName).getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("English name").fill(editedAreaName);
    await page.getByLabel("Display order").fill("5");
    await page.getByLabel("Active and available for addressing").uncheck();
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/locations/${createdAreaId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expectResponse(await responsePromise, 200);
    await expect(areaRow(editedAreaName)).toContainText("Inactive");

    await expect.poll(async () => prisma.city.findUnique({ where: { id: createdCityId }, select: { nameEn: true, displayOrder: true, isActive: true } })).toEqual({ nameEn: editedCityName, displayOrder: 89, isActive: true });
    await expect.poll(async () => prisma.area.findUnique({ where: { id: createdAreaId }, select: { cityId: true, nameEn: true, displayOrder: true, isActive: true } })).toEqual({ cityId: createdCityId, nameEn: editedAreaName, displayOrder: 5, isActive: false });
  });

  test("allows a seeded administrator to create a bilingual product", async ({ page }) => {
    await loginAdmin(page, "/en/admin/products/new");
    const productName = `E2E Inventory Product ${runId}`;
    const sku = `E2E-${runId.slice(-12).toUpperCase()}`;
    createdProductName = productName;
    createdProductSku = sku;

    await page.getByLabel("English name").fill(productName);
    await page.getByLabel("الاسم بالعربية").fill(`منتج اختبار ${runId}`);
    await page.getByLabel("SKU", { exact: true }).fill(sku);
    await expect(page.getByLabel("URL slug")).toHaveCount(0);
    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByLabel("Normal price").fill("25.50");
    await page.getByLabel("Enable sale").check();
    await page.getByLabel("Sale price", { exact: true }).fill("20.40");
    await page.getByLabel("Base product stock").fill("11");
    await page.getByLabel("Low-stock threshold").fill("3");
    await page.getByLabel("English description").fill("A real product created by the seeded PostgreSQL E2E suite.");
    await page.getByLabel("الوصف بالعربية").fill("منتج حقيقي أنشأه اختبار قاعدة البيانات.");

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/products") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    const payload = await expectResponse(await responsePromise, 201);
    createdProductId = (payload.data as { id?: string } | undefined)?.id ?? "";
    expect(createdProductId).not.toBe("");

    await page.waitForURL((url) => url.pathname === `/en/admin/products/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
    await expect(page.getByText(sku, { exact: false })).toBeVisible();
    await expect(page.getByText(/Current sale status:/)).toContainText("ACTIVE");
    await gotoHydrated(page, `/en/admin/products?search=${encodeURIComponent(sku)}`);
    const createdRow = page.locator("tbody tr").filter({ hasText: sku });
    await expect(createdRow).toContainText("20% off");
    await expect(createdRow).toContainText("20.40");
  });

  test("uploads, reorders, persists, and removes real product images", async ({ page }) => {
    await loginAdmin(page, `/en/admin/products/${createdProductId}`);
    const imageSection = page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "Product images" }) }).first();
    const fileInput = imageSection.locator('input[type="file"]');
    const fixtures = [
      path.join(process.cwd(), "public", "images", "products", "clipper.png"),
      path.join(process.cwd(), "public", "images", "products", "styling-clay.png"),
    ];
    const storageKeys: string[] = [];

    for (const fixture of fixtures) {
      const uploadPromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/admin/uploads") && response.request().method() === "POST",
      );
      await fileInput.setInputFiles(fixture);
      const upload = await expectResponse(await uploadPromise, 201);
      const storageKey = (upload.data as { storageKey?: string } | undefined)?.storageKey ?? "";
      expect(storageKey).toMatch(/^[a-f0-9-]+\.png$/);
      storageKeys.push(storageKey);
      uploadedImageKeys.add(storageKey);
      await expect.poll(() => uploadedFileExists(storageKey)).toBe(true);
    }

    await imageSection.getByLabel("English alt text").nth(0).fill("E2E clipper image");
    await imageSection.getByLabel("English alt text").nth(1).fill("E2E styling image");
    let savePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await savePromise, 200);
    await expect.poll(async () => prisma.productImage.findMany({ where: { productId: createdProductId }, orderBy: { displayOrder: "asc" }, select: { storageKey: true, displayOrder: true, isPrimary: true } })).toEqual([
      { storageKey: storageKeys[0], displayOrder: 0, isPrimary: true },
      { storageKey: storageKeys[1], displayOrder: 1, isPrimary: false },
    ]);

    await imageSection.getByRole("button", { name: "Move image up" }).nth(1).click();
    savePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await savePromise, 200);
    await expect.poll(async () => prisma.productImage.findMany({ where: { productId: createdProductId }, orderBy: { displayOrder: "asc" }, select: { storageKey: true, displayOrder: true, isPrimary: true } })).toEqual([
      { storageKey: storageKeys[1], displayOrder: 0, isPrimary: true },
      { storageKey: storageKeys[0], displayOrder: 1, isPrimary: false },
    ]);

    await imageSection.getByRole("button", { name: "Remove image" }).nth(1).click();
    savePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await savePromise, 200);
    await expect.poll(() => uploadedFileExists(storageKeys[0] ?? "")).toBe(false);
    await expect.poll(async () => prisma.productImage.findMany({ where: { productId: createdProductId }, select: { storageKey: true, isPrimary: true } })).toEqual([
      { storageKey: storageKeys[1], isPrimary: true },
    ]);

    await imageSection.getByRole("button", { name: "Remove image" }).click();
    savePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await savePromise, 200);
    await expect.poll(() => uploadedFileExists(storageKeys[1] ?? "")).toBe(false);
    await expect.poll(() => prisma.productImage.count({ where: { productId: createdProductId } })).toBe(0);
  });

  test("updates, validates, publishes, and removes a product sale", async ({ page }) => {
    await loginAdmin(page, `/en/admin/products/${createdProductId}`);
    await expect(page.getByLabel("Enable sale")).toBeChecked();
    await expect(page.getByLabel("Sale price", { exact: true })).toHaveValue("20.4");

    await page.getByLabel("Discount input").selectOption("PERCENTAGE");
    await page.getByLabel("Discount percentage %").fill("10");
    let save = page.waitForResponse((response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await save, 200);

    await gotoHydrated(page, `/en/product/${createdProductId}`);
    await expect(page.locator("main del").filter({ hasText: "25.50" }).first()).toBeVisible();
    await expect(page.getByText(/22\.95/).first()).toBeVisible();
    await gotoHydrated(page, `/en/on-sale?q=${encodeURIComponent(createdProductName)}`);
    await expect(page.getByRole("heading", { name: createdProductName })).toBeVisible();

    const detailResponse = await page.request.get(`/api/admin/products/${createdProductId}`);
    const detailPayload = await expectResponse(detailResponse, 200);
    const detail = detailPayload.data as Record<string, unknown>;
    const invalid = await page.request.patch(`/api/admin/products/${createdProductId}`, { data: { ...detail, saleEnabled: true, saleInputMethod: "PRICE", salePrice: detail.price, salePercentage: null } });
    await expectResponse(invalid, 422);

    await gotoHydrated(page, `/en/admin/products/${createdProductId}`);
    await page.getByLabel("Enable sale").uncheck();
    save = page.waitForResponse((response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await save, 200);
    await gotoHydrated(page, `/en/on-sale?q=${encodeURIComponent(createdProductName)}`);
    await expect(page.getByRole("heading", { name: createdProductName })).toHaveCount(0);

    await gotoHydrated(page, `/en/admin/products/${createdProductId}`);
    await page.getByLabel("Enable sale").check();
    await page.getByLabel("Sale price", { exact: true }).fill("20.40");
    save = page.waitForResponse((response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await save, 200);
  });

  test("reconciles a changed sale price before checkout and snapshots the latest database price", async ({ page }) => {
    await loginCustomer(page);
    const historical = await prisma.orderItem.findFirstOrThrow({ orderBy: { orderId: "asc" }, select: { id: true, unitPrice: true } });
    const historicalPrice = historical.unitPrice.toFixed(2);

    const added = await page.request.post("/api/cart", { data: { productId: createdProductId, variantId: null, quantity: 1 } });
    const addedPayload = await expectResponse(added, 201);
    const addedCart = addedPayload.cart as { items?: Array<{ id: string; productId: string; unitPrice: string }> };
    expect(addedCart.items?.find((item) => item.productId === createdProductId)?.unitPrice).toBe("20.40");

    await prisma.product.update({ where: { id: createdProductId }, data: { isOnSale: true, salePrice: "20.40", saleStartsAt: null, saleEndsAt: new Date(Date.now() - 60_000), saleUpdatedAt: new Date() } });
    const changed = await page.request.get("/api/cart");
    const changedPayload = await expectResponse(changed, 200);
    const changedCart = changedPayload.cart as { items?: Array<{ id: string; productId: string; unitPrice: string }>; issues?: Array<{ code: string }> };
    expect(changedCart.items?.find((item) => item.productId === createdProductId)?.unitPrice).toBe("25.50");
    expect(changedCart.issues?.some((issue) => issue.code === "PRICE_CHANGED")).toBe(true);

    const staleCheckout = await page.request.post("/api/checkout", { data: { fulfillmentMethod: "PICKUP", name: `E2E Customer ${runId}`, phone: customerPhone, acceptPolicies: true } });
    await expectResponse(staleCheckout, 400);
    const acknowledged = await page.request.patch("/api/cart");
    const acknowledgedPayload = await expectResponse(acknowledged, 200);
    expect((acknowledgedPayload.cart as { issues?: Array<{ code: string }> }).issues?.some((issue) => issue.code === "PRICE_CHANGED")).toBe(false);

    const checkout = await page.request.post("/api/checkout", { data: { fulfillmentMethod: "PICKUP", name: `E2E Customer ${runId}`, phone: customerPhone, acceptPolicies: true } });
    const checkoutPayload = await expectResponse(checkout, 201);
    saleTestOrderId = ((checkoutPayload.order as { id?: string })?.id) ?? "";
    const snapshot = await prisma.orderItem.findFirstOrThrow({ where: { orderId: saleTestOrderId, productId: createdProductId }, select: { unitPrice: true } });
    expect(snapshot.unitPrice.toFixed(2)).toBe("25.50");
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: historical.id }, select: { unitPrice: true } })).unitPrice.toFixed(2)).toBe(historicalPrice);

    await prisma.product.update({ where: { id: createdProductId }, data: { isOnSale: true, salePrice: "20.40", saleStartsAt: null, saleEndsAt: null, saleUpdatedAt: new Date() } });
  });

  test("edits the created product and reflects availability on the storefront", async ({ page }) => {
    await loginAdmin(page, `/en/admin/products/${createdProductId}`);
    const editedName = `${createdProductName} Edited`;
    await page.getByLabel("English name").fill(editedName);
    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await responsePromise, 200);
    await expect(page.getByRole("heading", { level: 1, name: editedName })).toBeVisible();

    await gotoHydrated(page, `/en/product/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: editedName })).toBeVisible();
    await gotoHydrated(page, `/ar/product/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: `منتج اختبار ${runId}` })).toBeVisible();
    await gotoHydrated(page, "/en/product/not-a-real-product-id");
    await expect(page.getByRole("heading", { level: 1, name: "That page is not on the shelf" })).toBeVisible();

    await gotoHydrated(page, `/en/admin/products/${createdProductId}`);
    await page.getByLabel("Available for sale").uncheck();
    const hideResponse = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await hideResponse, 200);
    await gotoHydrated(page, `/en/product/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: "That page is not on the shelf" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: editedName })).toHaveCount(0);

    await gotoHydrated(page, `/en/admin/products/${createdProductId}`);
    await page.getByLabel("Available for sale").check();
    const restoreResponse = page.waitForResponse(
      (response) => response.url().endsWith(`/api/admin/products/${createdProductId}`) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expectResponse(await restoreResponse, 200);
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

    const inventoryRow = () => page.getByRole("row").filter({
      hasText: sku,
      has: page.getByRole("button", { name: "Adjust stock" }),
    });
    let row = inventoryRow();
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(3)).toHaveText("11");
    await row.getByRole("button", { name: "Adjust stock" }).click();
    const adjustmentPanel = page.getByRole("region", { name: "Manual inventory adjustment" });
    await expect(adjustmentPanel).toBeVisible();
    await expect(adjustmentPanel).toBeFocused();
    await page.getByLabel("Quantity change").fill("3");
    await page.getByLabel("Reason").fill(`E2E ${runId} stock verification`);

    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/inventory") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expectResponse(await responsePromise, 201);
    row = inventoryRow();
    await expect(row.getByRole("cell").nth(3)).toHaveText("14");

    await row.getByRole("button", { name: "Adjust stock" }).click();
    await page.getByLabel("Adjustment method").selectOption("SET_EXACT");
    await page.getByLabel("Exact new stock").fill("11");
    await page.getByLabel("Reason").fill(`E2E ${runId} exact stock reset`);
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/inventory") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save adjustment" }).click();
    await expectResponse(await responsePromise, 201);
    await expect(inventoryRow().getByRole("cell").nth(3)).toHaveText("11");

    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: { productId: createdProductId, type: "MANUAL_CORRECTION" },
      orderBy: { createdAt: "asc" },
      select: { previousStock: true, quantityDelta: true, newStock: true, reason: true },
    });
    expect(adjustments.slice(-2)).toEqual([
      { previousStock: 11, quantityDelta: 3, newStock: 14, reason: `E2E ${runId} stock verification` },
      { previousStock: 14, quantityDelta: -3, newStock: 11, reason: `E2E ${runId} exact stock reset` },
    ]);
    await expect(page.getByRole("heading", { name: "Inventory adjustment history" }).locator("xpath=ancestor::section")).toContainText(createdProductSku);
  });

  test("allows only one concurrent confirmation to consume the final unit and keeps retries idempotent", async ({ page }) => {
    await loginAdmin(page);
    const category = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
    const customer = await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true, name: true, email: true, phone: true } });
    if (!category || !customer) throw new Error("Concurrency test prerequisites are missing");
    const suffix = `${runId.slice(-10)}-${Date.now()}`;
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        sku: `FINAL-${suffix}`.slice(0, 64),
        nameAr: "منتج آخر وحدة",
        nameEn: "Final unit concurrency product",
        descriptionAr: "منتج لاختبار التزامن.",
        descriptionEn: "Product used for the final-unit concurrency test.",
        price: "10.00",
        stockQuantity: 1,
        status: "ACTIVE",
        isAvailable: true,
      },
    });
    const orderIds: string[] = [];
    let staleCartId = "";
    try {
      for (const index of [1, 2]) {
        const order = await prisma.order.create({
          data: {
            orderNumber: `JYS-CONCURRENT-${suffix}-${index}`.slice(0, 64),
            userId: customer.id,
            fulfillmentMethod: "PICKUP",
            paymentMethod: "CASH_ON_PICKUP",
            currency: "ILS",
            subtotal: "10.00",
            total: "10.00",
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone ?? "0590000000",
            policyAcceptedAt: new Date(),
            items: {
              create: {
                productId: product.id,
                skuSnapshot: product.sku,
                productNameAr: product.nameAr,
                productNameEn: product.nameEn,
                unitPrice: "10.00",
                quantity: 1,
                lineTotal: "10.00",
              },
            },
            statusHistory: { create: { toStatus: "NEW" } },
          },
          select: { id: true },
        });
        orderIds.push(order.id);
      }

      const confirmations = await Promise.all(orderIds.map((id) => page.request.patch(`/api/admin/orders/${id}`, {
        data: { status: "CONFIRMED", note: `Concurrent final-unit probe ${suffix}` },
      })));
      expect(confirmations.filter((response) => response.status() === 200)).toHaveLength(1);
      const rejected = confirmations.find((response) => response.status() !== 200);
      expect(rejected).toBeDefined();
      expect([400, 409, 422]).toContain(rejected?.status());
      expect(JSON.stringify(await responseJson(rejected!))).toMatch(/stock|inventory|changed/i);
      expect((await prisma.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } }))?.stockQuantity).toBe(0);
      expect(await prisma.inventoryAdjustment.count({ where: { productId: product.id, type: "ORDER_DEDUCTION" } })).toBe(1);

      const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, status: true } });
      const winner = orders.find((order) => order.status === "CONFIRMED");
      const loser = orders.find((order) => order.status === "NEW");
      if (!winner || !loser) throw new Error("Concurrent confirmation did not leave one winner and one rejected order");

      await prisma.cart.updateMany({ where: { userId: customer.id, status: "ACTIVE" }, data: { status: "ABANDONED" } });
      const staleCart = await prisma.cart.create({
        data: {
          userId: customer.id,
          items: {
            create: {
              productId: product.id,
              targetKey: `product:${product.id}`,
              quantity: 1,
              priceSnapshot: product.price,
            },
          },
        },
        select: { id: true },
      });
      staleCartId = staleCart.id;
      await page.request.post("/api/auth/logout");
      await loginCustomer(page, "/en/cart");
      const staleLine = page.locator("article").filter({ hasText: product.nameEn });
      await expect(staleLine).toContainText("Currently unavailable");
      await expect(page.locator('[aria-disabled="true"]').filter({ hasText: "Checkout" })).toBeVisible();
      const orderCountBefore = await prisma.order.count({ where: { userId: customer.id } });
      const staleCheckout = await page.request.post("/api/checkout", {
        data: {
          fulfillmentMethod: "PICKUP",
          name: customer.name,
          phone: customer.phone ?? "0590000000",
          acceptPolicies: true,
        },
      });
      await expectResponse(staleCheckout, 400);
      expect(await prisma.order.count({ where: { userId: customer.id } })).toBe(orderCountBefore);

      await page.request.post("/api/auth/logout");
      await loginAdmin(page);
      await expectResponse(await page.request.patch(`/api/admin/orders/${winner.id}`, { data: { status: "CONFIRMED" } }), 200);
      expect(await prisma.inventoryAdjustment.count({ where: { productId: product.id, type: "ORDER_DEDUCTION" } })).toBe(1);
      await expectResponse(await page.request.patch(`/api/admin/orders/${winner.id}`, { data: { status: "CANCELLED" } }), 200);
      await expectResponse(await page.request.patch(`/api/admin/orders/${winner.id}`, { data: { status: "CANCELLED" } }), 200);
      await expectResponse(await page.request.patch(`/api/admin/orders/${loser.id}`, { data: { status: "CANCELLED" } }), 200);
      expect((await prisma.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } }))?.stockQuantity).toBe(1);
      expect(await prisma.inventoryAdjustment.count({ where: { productId: product.id, type: "ORDER_RESTORATION" } })).toBe(1);
    } finally {
      if (staleCartId) await prisma.cart.deleteMany({ where: { id: staleCartId } });
      await prisma.inventoryAdjustment.deleteMany({ where: { productId: product.id } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.product.delete({ where: { id: product.id } });
    }
  });

  test("updates settings and policy content and exposes the saved public values", async ({ page }) => {
    await loginAdmin(page, "/en/admin/settings");
    const storeName = page.getByLabel("English store name");
    const originalStoreName = await storeName.inputValue();
    const updatedStoreName = `${originalStoreName} E2E`;
    await storeName.fill(updatedStoreName);
    let responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save settings" }).click();
    await expectResponse(await responsePromise, 200);
    expect((await prisma.siteSetting.findUnique({ where: { key: "store.profile" } }))?.value).toMatchObject({ nameEn: updatedStoreName });

    await gotoHydrated(page, "/en/admin/content");
    await page.getByRole("tab", { name: "No-return policy" }).click();
    const content = page.getByLabel("English content");
    const originalContent = await content.inputValue();
    const marker = ` E2E policy ${runId}.`;
    await content.fill(`${originalContent}${marker}`);
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/content") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save content" }).click();
    await expectResponse(await responsePromise, 200);
    await gotoHydrated(page, "/en/no-returns");
    await expect(page.getByText(new RegExp(`E2E policy ${runId}`))).toBeVisible();
    await addProductToCart(page, createdProductId, `${createdProductName} Edited`);
    await gotoHydrated(page, "/en/checkout");
    await expect(page.getByText(new RegExp(`E2E policy ${runId}`))).toBeVisible();

    await gotoHydrated(page, "/en/admin/content");
    await page.getByRole("tab", { name: "No-return policy" }).click();
    await page.getByLabel("English content").fill(originalContent);
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/content") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save content" }).click();
    await expectResponse(await responsePromise, 200);

    await gotoHydrated(page, "/en/admin/settings");
    await page.getByLabel("English store name").fill(originalStoreName);
    responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/admin/settings") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save settings" }).click();
    await expectResponse(await responsePromise, 200);
  });

  test("filters reports and downloads all five authorized CSV exports", async ({ page }) => {
    await loginAdmin(page, "/en/admin/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports & analytics" })).toBeVisible();
    await page.getByLabel("Payment status").selectOption("PENDING");
    await page.getByLabel("Order status").selectOption("ALL");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/paymentStatus=PENDING/);
    await expect(page.locator("html")).toHaveAttribute("data-jys-hydrated", "true", { timeout: 30_000 });
    await expect(page.locator("html")).not.toHaveAttribute("data-jys-session-status", "loading", { timeout: 30_000 });

    for (const type of ["orders", "sales", "products", "inventory", "customers"]) {
      const response = await page.request.get(`/api/admin/reports/csv?type=${type}&status=ALL&paymentStatus=PENDING&locale=ar`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-disposition"]).toContain(`jys-${type}-report-`);
      expect((await response.body()).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Orders" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^jys-orders-report-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.getByRole("button", { name: "Export Orders" })).toBeEnabled();
  });

  test("archives the created product without deleting its ledger", async ({ page }) => {
    await loginAdmin(page, `/en/admin/products?search=${encodeURIComponent(createdProductSku)}`);
    const ledgerCount = await prisma.inventoryAdjustment.count({ where: { productId: createdProductId } });
    const response = await page.request.delete(`/api/admin/products/${createdProductId}`);
    await expectResponse(response, 200);
    expect((await prisma.product.findUnique({ where: { id: createdProductId }, select: { archivedAt: true } }))?.archivedAt).not.toBeNull();
    expect(await prisma.inventoryAdjustment.count({ where: { productId: createdProductId } })).toBe(ledgerCount);
    await gotoHydrated(page, `/en/product/${createdProductId}`);
    await expect(page.getByRole("heading", { level: 1, name: "That page is not on the shelf" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: createdProductName })).toHaveCount(0);
  });
});

test.describe("seeded PostgreSQL mobile admin reachability", () => {
  test.skip(!databaseReady, "Set E2E_DATABASE_READY=true only after migrating and seeding a disposable PostgreSQL test database.");

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The responsive admin navigation check runs only in the mobile project.");
  });

  test("opens every operational module and exposes its primary controls", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAdmin(page);

    async function openModule(linkName: string, pathname: string, heading: string) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const drawer = page.getByRole("dialog", { name: "Admin navigation" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("button", { name: "Close navigation" })).toBeVisible();
      await drawer.getByRole("link", { name: linkName, exact: true }).click();
      await page.waitForURL((url) => url.pathname === pathname);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoDocumentOverflow(page, `mobile-admin-${pathname}`);
    }

    await openModule("Products", "/en/admin/products", "Products");
    await expect(page.getByRole("link", { name: "Add product", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Add product", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/en/admin/products/new");
    await expect(page.getByRole("heading", { level: 1, name: "Create product" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page, "mobile-admin-create-product");

    await openModule("Inventory", "/en/admin/inventory", "Inventory");
    await expect(page.getByRole("button", { name: "Adjust stock" }).first()).toBeVisible();

    await openModule("Orders", "/en/admin/orders", "Orders");
    await expect(page.getByRole("search")).toBeVisible();

    await openModule("Customers", "/en/admin/customers", "Customers");
    await openModule("Cities & areas", "/en/admin/locations", "Delivery cities & areas");
    await openModule("Content", "/en/admin/content", "Content management");

    await openModule("Settings", "/en/admin/settings", "Website settings");
    await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();

    await openModule("Reports", "/en/admin/reports", "Reports");
    await expect(page.getByRole("button", { name: "Export Orders" })).toBeVisible();
  });
});
