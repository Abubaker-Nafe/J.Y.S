import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    order: { findUnique: vi.fn(), update: vi.fn() },
    product: { findUnique: vi.fn(), updateMany: vi.fn() },
    productVariant: { findFirst: vi.fn(), updateMany: vi.fn() },
    inventoryAdjustment: { create: vi.fn() },
  };
  const db = {
    order: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, tx };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmationEmail: vi.fn() }));

import {
  createManualInventoryAdjustment,
  getCustomerOrder,
  getCustomerOrders,
  transitionOrderStatus,
} from "./order-service";

describe("order and inventory database service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.$transaction.mockImplementation(async (work: unknown) => {
      if (Array.isArray(work)) return Promise.all(work);
      return (work as (tx: typeof mocks.tx) => unknown)(mocks.tx);
    });
  });

  it("rejects invalid adjustments before opening a transaction", async () => {
    await expect(createManualInventoryAdjustment({ productId: "product-1", quantityDelta: 0, reason: "valid", actorId: "admin-1" })).rejects.toThrow("non-zero integer");
    await expect(createManualInventoryAdjustment({ productId: "product-1", quantityDelta: 1, reason: "x", actorId: "admin-1" })).rejects.toThrow("reason is required");
    await expect(createManualInventoryAdjustment({ productId: "product-1", mode: "SET_EXACT", targetStock: -1, reason: "valid", actorId: "admin-1" })).rejects.toThrow("non-negative integer");
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("writes an exact product-stock correction with an audit-ready ledger entry", async () => {
    mocks.tx.product.findUnique.mockResolvedValue({ id: "product-1", stockQuantity: 9 });
    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.inventoryAdjustment.create.mockImplementation(async ({ data }: { data: unknown }) => ({ id: "adjustment-1", ...data as object }));

    const result = await createManualInventoryAdjustment({
      productId: "product-1",
      mode: "SET_EXACT",
      targetStock: 12,
      reason: "  Cycle count  ",
      actorId: "admin-1",
    });

    expect(mocks.tx.product.updateMany).toHaveBeenCalledWith({ where: { id: "product-1", stockQuantity: 9 }, data: { stockQuantity: 12 } });
    expect(mocks.tx.inventoryAdjustment.create).toHaveBeenCalledWith({ data: {
      productId: "product-1",
      variantId: null,
      type: "MANUAL_CORRECTION",
      quantityDelta: 3,
      previousStock: 9,
      newStock: 12,
      reason: "Cycle count",
      createdById: "admin-1",
    } });
    expect(result).toMatchObject({ id: "adjustment-1", newStock: 12 });
  });

  it("retries a serializable inventory transaction after a Prisma write conflict", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "6.19.3",
    });
    mocks.db.$transaction
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
    mocks.tx.product.findUnique.mockResolvedValue({ id: "product-1", stockQuantity: 2 });
    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.inventoryAdjustment.create.mockResolvedValue({ id: "adjustment-1" });

    await expect(createManualInventoryAdjustment({ productId: "product-1", quantityDelta: 1, reason: "Restock", actorId: "admin-1" })).resolves.toEqual({ id: "adjustment-1" });
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("rejects optimistic stock conflicts without writing a ledger row", async () => {
    mocks.tx.product.findUnique.mockResolvedValue({ id: "product-1", stockQuantity: 4 });
    mocks.tx.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(createManualInventoryAdjustment({ productId: "product-1", quantityDelta: 1, reason: "Restock", actorId: "admin-1" })).rejects.toThrow("Stock changed while the adjustment was being saved");
    expect(mocks.tx.inventoryAdjustment.create).not.toHaveBeenCalled();
  });

  it("keeps duplicate status submissions idempotent", async () => {
    const order = {
      id: "order-1",
      status: "CONFIRMED",
      fulfillmentMethod: "DELIVERY",
      inventoryDeductedAt: new Date(),
      inventoryRestoredAt: null,
      items: [],
    };
    mocks.tx.order.findUnique.mockResolvedValue(order);

    await expect(transitionOrderStatus({ orderId: "order-1", toStatus: "CONFIRMED", actorId: "admin-1" })).resolves.toBe(order);
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryAdjustment.create).not.toHaveBeenCalled();
  });

  it("deducts product stock exactly once when confirming an order", async () => {
    mocks.tx.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "NEW",
      fulfillmentMethod: "DELIVERY",
      inventoryDeductedAt: null,
      inventoryRestoredAt: null,
      confirmedAt: null,
      items: [{ productId: "product-1", variantId: null, quantity: 2 }],
    });
    mocks.tx.product.findUnique.mockResolvedValue({ stockQuantity: 5 });
    mocks.tx.product.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.inventoryAdjustment.create.mockResolvedValue({ id: "ledger-1" });
    mocks.tx.order.update.mockResolvedValue({ id: "order-1", status: "CONFIRMED" });

    await transitionOrderStatus({ orderId: "order-1", toStatus: "CONFIRMED", actorId: "admin-1", note: " Confirmed " });

    expect(mocks.tx.product.updateMany).toHaveBeenCalledWith({ where: { id: "product-1", stockQuantity: 5 }, data: { stockQuantity: 3 } });
    expect(mocks.tx.inventoryAdjustment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      productId: "product-1",
      orderId: "order-1",
      type: "ORDER_DEDUCTION",
      quantityDelta: -2,
      previousStock: 5,
      newStock: 3,
    }) });
    expect(mocks.tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-1" },
      data: expect.objectContaining({ status: "CONFIRMED", inventoryDeductedAt: expect.any(Date) }),
    }));
  });

  it("clamps customer pagination and formats Decimal totals", async () => {
    mocks.db.order.findMany.mockResolvedValue([{ id: "order-1", subtotal: new Prisma.Decimal("12.30"), orderNumber: "JYS-1" }]);
    mocks.db.order.count.mockResolvedValue(51);

    const result = await getCustomerOrders("user-1", 0, 999);

    expect(mocks.db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" }, skip: 0, take: 50 }));
    expect(result).toEqual({
      orders: [{ id: "order-1", orderNumber: "JYS-1", total: "12.30" }],
      pagination: { page: 1, pageSize: 50, total: 51, pageCount: 2 },
    });
  });

  it("enforces order ownership and returns product-only formatted totals", async () => {
    mocks.db.order.findFirst.mockResolvedValueOnce(null);
    await expect(getCustomerOrder("user-1", "other-order")).resolves.toBeNull();

    mocks.db.order.findFirst.mockResolvedValueOnce({
      id: "order-1",
      userId: "user-1",
      subtotal: new Prisma.Decimal("19.99"),
      deliveryFee: new Prisma.Decimal("8.00"),
      total: new Prisma.Decimal("27.99"),
      items: [{ id: "line-1", unitPrice: new Prisma.Decimal("19.99"), lineTotal: new Prisma.Decimal("19.99") }],
      statusHistory: [],
    });
    const order = await getCustomerOrder("user-1", "order-1");

    expect(mocks.db.order.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "order-1", userId: "user-1" } }));
    expect(order).toMatchObject({ subtotal: "19.99", total: "19.99", items: [{ unitPrice: "19.99", lineTotal: "19.99" }] });
    expect(order).not.toHaveProperty("deliveryFee");
  });
});
