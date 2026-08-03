import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    product: { findFirst: vi.fn() },
    wishlistItem: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { addWishlistItem, getWishlist, removeWishlistItem } from "./wishlist-service";

function wishlistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wishlist-1",
    productId: "product-1",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    product: {
      id: "product-1",
      nameAr: "منتج",
      nameEn: "Product",
      price: new Prisma.Decimal("20.00"),
      isOnSale: true,
      salePrice: new Prisma.Decimal("15.00"),
      saleStartsAt: null,
      saleEndsAt: null,
      status: "ACTIVE",
      archivedAt: null,
      isAvailable: true,
      stockQuantity: 0,
      images: [{ url: "/images/product.png" }],
      variants: [{ stockQuantity: 2, isActive: true, isAvailable: true }],
    },
    ...overrides,
  };
}

describe("wishlist database service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.wishlistItem.findMany.mockResolvedValue([]);
  });

  it("maps sale pricing, image, and variant availability", async () => {
    mocks.db.wishlistItem.findMany.mockResolvedValue([wishlistRow()]);

    const items = await getWishlist("user-1");

    expect(items).toHaveLength(1);
    expect(items[0]?.product).toMatchObject({
      price: "20.00",
      effectivePrice: "15.00",
      onSale: true,
      discountPercentage: 25,
      imageUrl: "/images/product.png",
      isAvailable: true,
    });
    expect(mocks.db.wishlistItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
  });

  it("marks archived and out-of-stock products unavailable", async () => {
    const row = wishlistRow();
    mocks.db.wishlistItem.findMany.mockResolvedValue([
      { ...row, product: { ...row.product, archivedAt: new Date(), variants: [] } },
      { ...row, id: "wishlist-2", productId: "product-2", product: { ...row.product, id: "product-2", variants: [], stockQuantity: 0 } },
    ]);

    const items = await getWishlist("user-1");
    expect(items.map((item) => item.product.isAvailable)).toEqual([false, false]);
  });

  it("rejects unavailable products before writing", async () => {
    mocks.db.product.findFirst.mockResolvedValue(null);
    await expect(addWishlistItem("user-1", "missing")).rejects.toThrow("Product was not found");
    expect(mocks.db.wishlistItem.upsert).not.toHaveBeenCalled();
  });

  it("uses the user-product unique key for idempotent additions", async () => {
    mocks.db.product.findFirst.mockResolvedValue({ id: "product-1" });
    mocks.db.wishlistItem.upsert.mockResolvedValue({ id: "wishlist-1" });

    await addWishlistItem("user-1", "product-1");

    expect(mocks.db.wishlistItem.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: "user-1", productId: "product-1" } },
      create: { userId: "user-1", productId: "product-1" },
      update: {},
    });
  });

  it("scopes removals to both the authenticated user and product", async () => {
    mocks.db.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });

    await removeWishlistItem("user-1", "product-1");

    expect(mocks.db.wishlistItem.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", productId: "product-1" } });
  });
});
