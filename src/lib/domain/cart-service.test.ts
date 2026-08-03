import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/validation/common";

const mocks = vi.hoisted(() => {
  const tx = {
    cart: { findFirst: vi.fn(), create: vi.fn() },
    cartItem: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn() },
  };
  const db = {
    cart: { findFirst: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    siteSetting: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import {
  acknowledgeCartPrices,
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./cart-service";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    sku: "SKU-1",
    nameAr: "منتج",
    nameEn: "Product",
    price: new Prisma.Decimal("10.00"),
    isOnSale: false,
    salePrice: null,
    saleStartsAt: null,
    saleEndsAt: null,
    status: "ACTIVE",
    archivedAt: null,
    isAvailable: true,
    stockQuantity: 5,
    images: [{ url: "/images/product.png" }],
    variants: [],
    ...overrides,
  };
}

function cartItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    cartId: "cart-1",
    productId: "product-1",
    variantId: null,
    targetKey: "product:product-1",
    quantity: 1,
    priceSnapshot: new Prisma.Decimal("10.00"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    product: product(),
    variant: null,
    ...overrides,
  };
}

describe("cart database service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.$transaction.mockImplementation(async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
    mocks.db.cart.findFirst.mockResolvedValue(null);
    mocks.db.siteSetting.findUnique.mockResolvedValue({ value: "ILS" });
  });

  it("returns a stable empty cart with the configured currency", async () => {
    await expect(getCart("user-1")).resolves.toEqual({
      id: null,
      items: [],
      subtotal: "0.00",
      currency: "ILS",
      issues: [],
    });
    expect(mocks.db.cart.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", status: "ACTIVE" } }));
  });

  it("recalculates sale prices and reports stale and unavailable lines", async () => {
    const saleProduct = product({
      isOnSale: true,
      salePrice: new Prisma.Decimal("8.00"),
      stockQuantity: 1,
    });
    mocks.db.cart.findFirst.mockResolvedValue({
      id: "cart-1",
      items: [cartItem({ quantity: 2, product: saleProduct })],
    });

    const cart = await getCart("user-1");

    expect(cart.subtotal).toBe("16.00");
    expect(cart.items[0]).toMatchObject({ unitPrice: "8.00", lineTotal: "16.00", priceChanged: true, isAvailable: false, availableStock: 1 });
    expect(cart.issues).toEqual([
      { itemId: "item-1", code: "UNAVAILABLE_OR_LOW_STOCK" },
      { itemId: "item-1", code: "PRICE_CHANGED" },
    ]);
  });

  it("creates an active cart item using the current sale price", async () => {
    mocks.tx.product.findUnique.mockResolvedValue(product({ isOnSale: true, salePrice: new Prisma.Decimal("7.50") }));
    mocks.tx.cart.findFirst.mockResolvedValue(null);
    mocks.tx.cart.create.mockResolvedValue({ id: "cart-1" });
    mocks.tx.cartItem.findUnique.mockResolvedValue(null);
    mocks.tx.cartItem.upsert.mockResolvedValue({ id: "item-1" });

    await addCartItem("user-1", { productId: "product-1", quantity: 2 });

    expect(mocks.tx.cartItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ cartId: "cart-1", productId: "product-1", quantity: 2, targetKey: "product:product-1" }),
    }));
    const create = mocks.tx.cartItem.upsert.mock.calls[0]?.[0].create as { priceSnapshot: Prisma.Decimal };
    expect(create.priceSnapshot.toFixed(2)).toBe("7.50");
  });

  it("rejects missing products and products that require a variant", async () => {
    mocks.tx.product.findUnique.mockResolvedValueOnce(null);
    await expect(addCartItem("user-1", { productId: "missing", quantity: 1 })).rejects.toThrow(new ValidationError("Product was not found"));

    mocks.tx.product.findUnique.mockResolvedValueOnce(product({ variants: [{ id: "variant-1" }] }));
    await expect(addCartItem("user-1", { productId: "product-1", quantity: 1 })).rejects.toThrow("VARIANT_REQUIRED");
  });

  it("acknowledges changed prices inside the transaction", async () => {
    const item = cartItem({ product: product({ isOnSale: true, salePrice: new Prisma.Decimal("8.00") }) });
    mocks.tx.cart.findFirst.mockResolvedValue({ id: "cart-1", items: [item] });
    mocks.tx.cartItem.update.mockResolvedValue({ id: "item-1" });

    await acknowledgeCartPrices("user-1");

    expect(mocks.tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { priceSnapshot: expect.any(Prisma.Decimal) },
    });
  });

  it("updates only an owned active item with a fresh price snapshot", async () => {
    mocks.tx.cartItem.findFirst.mockResolvedValue(cartItem());
    mocks.tx.cartItem.update.mockResolvedValue({ id: "item-1" });

    await updateCartItem("user-1", "item-1", 3);

    expect(mocks.tx.cartItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1", cart: { userId: "user-1", status: "ACTIVE" } },
    }));
    expect(mocks.tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 3, priceSnapshot: expect.any(Prisma.Decimal) },
    });
  });

  it("rejects removal when no owned active cart item was deleted", async () => {
    mocks.db.cartItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeCartItem("user-1", "item-1")).rejects.toThrow("Cart item was not found");
    expect(mocks.db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { id: "item-1", cart: { userId: "user-1", status: "ACTIVE" } },
    });
  });
});
