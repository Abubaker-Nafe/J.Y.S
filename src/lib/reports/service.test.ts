import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    order: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    productView: { groupBy: vi.fn() },
    wishlistItem: { groupBy: vi.fn() },
    cartItem: { groupBy: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    cart: { count: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { getReportData } from "./service";

function emptyDatabaseResults() {
  mocks.db.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  mocks.db.product.findMany.mockResolvedValue([]);
  mocks.db.orderItem.groupBy.mockResolvedValue([]);
  mocks.db.productView.groupBy.mockResolvedValue([]);
  mocks.db.wishlistItem.groupBy.mockResolvedValue([]);
  mocks.db.cartItem.groupBy.mockResolvedValue([]);
  mocks.db.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
  mocks.db.user.findMany.mockResolvedValue([]);
  mocks.db.cart.count.mockResolvedValue(0);
}

describe("report database service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes invalid filters and returns bounded empty report buckets", async () => {
    emptyDatabaseResults();

    const report = await getReportData({
      from: "not-a-date",
      to: "2026-99-99",
      status: "INVALID" as never,
      categoryId: "   ",
      group: "day",
    });

    expect(report.status).toBe("FULFILLED");
    expect(report.categoryId).toBe("");
    expect(report.metrics).toMatchObject({ revenue: 0, orderCount: 0, averageOrderValue: 0, registeredCustomers: 0 });
    expect(report.salesSeries.length).toBeGreaterThanOrEqual(29);
    expect(report.salesSeries.length).toBeLessThanOrEqual(31);
    expect(mocks.db.order.findMany.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ["DELIVERED", "COLLECTED"] } }),
    }));
  });

  it("aggregates filtered revenue, product signals, customers, and insights", async () => {
    const createdAt = new Date("2026-08-02T10:00:00.000Z");
    mocks.db.order.findMany
      .mockResolvedValueOnce([{
        id: "order-1",
        orderNumber: "JYS-1",
        createdAt,
        customerName: "Customer",
        customerEmail: "customer@example.com",
        customerPhone: "+970599000000",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH_ON_DELIVERY",
        paymentStatus: "PAID",
        status: "DELIVERED",
        currency: "ILS",
        subtotal: new Prisma.Decimal("40.00"),
        _count: { items: 2 },
      }])
      .mockResolvedValueOnce([
        { status: "DELIVERED", fulfillmentMethod: "DELIVERY" },
        { status: "CANCELLED", fulfillmentMethod: "DELIVERY" },
      ])
      .mockResolvedValueOnce([
        { items: [{ productId: "product-1", productNameAr: "منتج", productNameEn: "Product" }, { productId: "product-2", productNameAr: "آخر", productNameEn: "Other" }] },
        { items: [{ productId: "product-1", productNameAr: "منتج", productNameEn: "Product" }, { productId: "product-2", productNameAr: "آخر", productNameEn: "Other" }] },
      ]);
    mocks.db.product.findMany.mockResolvedValue([{
      id: "product-1",
      sku: "SKU-1",
      nameAr: "منتج",
      nameEn: "Product",
      status: "ACTIVE",
      isAvailable: true,
      price: new Prisma.Decimal("100.00"),
      isOnSale: true,
      salePrice: new Prisma.Decimal("80.00"),
      saleStartsAt: null,
      saleEndsAt: null,
      stockQuantity: 1,
      lowStockThreshold: 5,
      variants: [],
      category: { id: "category-1", nameAr: "تصنيف", nameEn: "Category" },
    }]);
    mocks.db.orderItem.groupBy.mockResolvedValue([{ productId: "product-1", _sum: { quantity: 2, lineTotal: new Prisma.Decimal("40.00") } }]);
    mocks.db.productView.groupBy.mockResolvedValue([{ productId: "product-1", _count: { _all: 7 } }]);
    mocks.db.wishlistItem.groupBy.mockResolvedValue([{ productId: "product-1", _count: { _all: 4 } }]);
    mocks.db.cartItem.groupBy.mockResolvedValue([{ productId: "product-1", _sum: { quantity: 3 } }]);
    mocks.db.user.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mocks.db.user.findMany.mockResolvedValue([{
      id: "customer-1",
      name: "Customer",
      email: "customer@example.com",
      phone: "+970599000000",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      addresses: [{ city: { nameAr: "رام الله", nameEn: "Ramallah" } }],
      orders: [{ subtotal: new Prisma.Decimal("40.00"), createdAt }, { subtotal: new Prisma.Decimal("10.00"), createdAt: new Date("2026-08-01T10:00:00.000Z") }],
    }]);
    mocks.db.cart.count.mockResolvedValue(2);

    const report = await getReportData({
      from: "2026-08-01",
      to: "2026-08-31",
      status: "ALL",
      categoryId: "category-1",
      fulfillment: "DELIVERY",
      payment: "CASH_ON_DELIVERY",
      paymentStatus: "PAID",
      group: "month",
    });

    expect(report.metrics).toEqual(expect.objectContaining({
      revenue: 40,
      orderCount: 1,
      averageOrderValue: 40,
      deliveredOrders: 1,
      cancelledOrders: 1,
      deliveryOrders: 2,
      registeredCustomers: 3,
      newCustomers: 1,
      returningCustomers: 1,
      abandonedCarts: 2,
    }));
    expect(report.products[0]).toMatchObject({
      id: "product-1",
      units: 2,
      revenue: 40,
      views: 7,
      wishlists: 4,
      cartAdds: 3,
      stock: 1,
      normalPrice: 100,
      salePrice: 80,
      effectivePrice: 80,
      discountPercentage: 20,
      saleStatus: "ACTIVE",
    });
    expect(report.categories).toEqual([{ id: "category-1", nameAr: "تصنيف", nameEn: "Category", units: 2, revenue: 40 }]);
    expect(report.customers[0]).toMatchObject({ orderCount: 2, spending: 50, cityEn: "Ramallah" });
    expect(report.insights.map((insight) => insight.key)).toEqual(expect.arrayContaining(["restock", "top-category", "pair", "wishlist", "carts"]));
    expect(report.salesSeries).toEqual([{ period: "2026-08", revenue: 40, orders: 1 }]);

    const firstOrderQuery = mocks.db.order.findMany.mock.calls[0]?.[0];
    expect(firstOrderQuery.where).toEqual(expect.objectContaining({
      items: { some: { product: { categoryId: "category-1" } } },
      fulfillmentMethod: "DELIVERY",
      paymentMethod: "CASH_ON_DELIVERY",
      paymentStatus: "PAID",
    }));
  });
});
