import { randomBytes } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type { CheckoutInput } from "@/lib/validation/commerce";
import { ValidationError } from "@/lib/validation/common";
import { getProductAvailability, validateRequestedQuantity } from "./catalog";
import { currencyFromSetting } from "./currency";
import { inventoryActionForTransition } from "./inventory";
import { calculateOrderTotals, minorToMoney, moneyToMinor } from "./money";
import { resolveSalePricing } from "./pricing";
import {
  assertOrderTransition,
  isCompletedStatus,
  type DomainFulfillmentMethod,
  type DomainOrderStatus,
} from "./order-rules";

function createOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `JYS-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function serializableTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Serializable transaction retry exhausted");
}

export async function createOrderFromCart(userId: string, input: CheckoutInput) {
  const order = await serializableTransaction(
    async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, status: "ACTIVE" },
        select: { id: true, email: true },
      });
      if (!user) throw new ValidationError("Customer account is unavailable");

      const currencySetting = await tx.siteSetting.findUnique({
        where: { key: "commerce.currency" },
        select: { value: true },
      });
      const currency = currencyFromSetting(currencySetting?.value);

      const cart = await tx.cart.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        include: {
          items: {
            include: {
              product: {
                include: {
                  variants: { select: { id: true } },
                  images: {
                    where: { isPrimary: true },
                    orderBy: { displayOrder: "asc" },
                    take: 1,
                  },
                },
              },
              variant: true,
            },
          },
        },
      });
      if (!cart || cart.items.length === 0) throw new ValidationError("Your cart is empty");

      let city:
        | { id: string; nameAr: string; nameEn: string }
        | null = null;
      let area:
        | { id: string; nameAr: string; nameEn: string }
        | null = null;
      if (input.fulfillmentMethod === "DELIVERY") {
        city = await tx.city.findFirst({
          where: { id: input.cityId, isActive: true },
          select: { id: true, nameAr: true, nameEn: true },
        });
        if (!city) throw new ValidationError("Selected city is unavailable");
        if (input.areaId) {
          area = await tx.area.findFirst({
            where: { id: input.areaId, cityId: city.id, isActive: true },
            select: { id: true, nameAr: true, nameEn: true },
          });
          if (!area) throw new ValidationError("Selected area is unavailable");
        }
      }

      const now = new Date();
      const lines = cart.items.map((item) => {
        const availability = getProductAvailability({
          status: item.product.status,
          archivedAt: item.product.archivedAt,
          isAvailable: item.product.isAvailable,
          stockQuantity: item.product.stockQuantity,
          hasVariants: item.product.variants.length > 0,
          variant: item.variant
            ? {
                belongsToProduct: item.variant.productId === item.productId,
                isActive: item.variant.isActive,
                isAvailable: item.variant.isAvailable,
                stockQuantity: item.variant.stockQuantity,
              }
            : null,
        });
        if (!availability.available) {
          throw new ValidationError(`${item.product.nameEn} is no longer available`);
        }
        try {
          validateRequestedQuantity(item.quantity, availability.availableStock);
        } catch {
          throw new ValidationError(`Only ${availability.availableStock} of ${item.product.nameEn} remain`);
        }
        const unitPrice = new Prisma.Decimal(resolveSalePricing({ normalPrice: item.product.price, isOnSale: item.product.isOnSale, salePrice: item.product.salePrice, saleStartsAt: item.product.saleStartsAt, saleEndsAt: item.product.saleEndsAt, productActive: item.product.status === "ACTIVE" && item.product.isAvailable, archived: Boolean(item.product.archivedAt) }, item.variant?.priceOverride ?? item.product.price, now).effectivePrice);
        if (!unitPrice.equals(item.priceSnapshot)) throw new ValidationError("Cart prices changed. Review and confirm the updated total before placing the order.");
        return { item, unitPrice, unitPriceMinor: moneyToMinor(unitPrice), quantity: item.quantity };
      });

      const totals = calculateOrderTotals(lines);
      const created = await tx.order.create({
        data: {
          orderNumber: createOrderNumber(now),
          userId,
          sourceCartId: cart.id,
          fulfillmentMethod: input.fulfillmentMethod,
          paymentMethod:
            input.fulfillmentMethod === "DELIVERY" ? "CASH_ON_DELIVERY" : "CASH_ON_PICKUP",
          currency,
          subtotal: new Prisma.Decimal(minorToMoney(totals.subtotalMinor)),
          deliveryFee: new Prisma.Decimal(0),
          total: new Prisma.Decimal(minorToMoney(totals.totalMinor)),
          customerName: input.name,
          customerEmail: user.email,
          customerPhone: input.phone,
          cityId: city?.id ?? null,
          areaId: area?.id ?? null,
          cityNameAr: city?.nameAr ?? null,
          cityNameEn: city?.nameEn ?? null,
          areaNameAr: area?.nameAr ?? null,
          areaNameEn: area?.nameEn ?? null,
          addressLine: input.fulfillmentMethod === "DELIVERY" ? input.addressLine : null,
          locationDetails:
            input.fulfillmentMethod === "DELIVERY" ? (input.locationDetails ?? null) : null,
          customerNotes: input.notes ?? null,
          policyAcceptedAt: now,
          items: {
            create: lines.map(({ item, unitPrice }) => ({
              productId: item.productId,
              variantId: item.variantId,
              skuSnapshot: item.variant?.sku ?? item.product.sku,
              productNameAr: item.product.nameAr,
              productNameEn: item.product.nameEn,
              variantLabelAr: item.variant?.labelAr ?? null,
              variantLabelEn: item.variant?.labelEn ?? null,
              unitPrice,
              quantity: item.quantity,
              lineTotal: unitPrice.mul(item.quantity),
              imageUrlSnapshot: item.product.images[0]?.url ?? null,
              imageAltArSnapshot: item.product.images[0]?.altAr ?? item.product.nameAr,
              imageAltEnSnapshot: item.product.images[0]?.altEn ?? item.product.nameEn,
            })),
          },
          statusHistory: { create: { toStatus: "NEW" } },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currency: true,
          fulfillmentMethod: true,
          customerEmail: true,
          customerName: true,
        },
      });
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CONVERTED", convertedAt: now },
      });
      return created;
    },
  );

  void sendOrderConfirmationEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    orderNumber: order.orderNumber,
    total: order.total.toFixed(2),
    currency: order.currency,
  }).catch((error: unknown) => {
    console.error("Order confirmation email failed", error instanceof Error ? error.message : "Unknown error");
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total.toFixed(2),
    currency: order.currency,
    fulfillmentMethod: order.fulfillmentMethod,
  };
}

async function mutateStockForOrder(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    items: Array<{ productId: string | null; variantId: string | null; quantity: number }>;
  },
  action: "DEDUCT" | "RESTORE",
  actorId: string,
): Promise<void> {
  const deltaMultiplier = action === "DEDUCT" ? -1 : 1;
  for (const item of order.items) {
    if (!item.productId) throw new ValidationError("Order references an unavailable product");
    let previousStock: number;
    let newStock: number;
    if (item.variantId) {
      const current = await tx.productVariant.findFirst({
        where: { id: item.variantId, productId: item.productId },
        select: { stockQuantity: true },
      });
      if (!current) throw new ValidationError("Order references an unavailable product variant");
      previousStock = current.stockQuantity;
      newStock = previousStock + item.quantity * deltaMultiplier;
      if (newStock < 0) throw new ValidationError("Insufficient stock to confirm this order");
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, productId: item.productId, stockQuantity: previousStock },
        data: { stockQuantity: newStock },
      });
      if (updated.count !== 1) throw new ValidationError("Insufficient stock to confirm this order");
    } else {
      const current = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stockQuantity: true },
      });
      if (!current) throw new ValidationError("Order references an unavailable product");
      previousStock = current.stockQuantity;
      newStock = previousStock + item.quantity * deltaMultiplier;
      if (newStock < 0) throw new ValidationError("Insufficient stock to confirm this order");
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stockQuantity: previousStock },
        data: { stockQuantity: newStock },
      });
      if (updated.count !== 1) throw new ValidationError("Insufficient stock to confirm this order");
    }
    await tx.inventoryAdjustment.create({
      data: {
        productId: item.productId,
        variantId: item.variantId,
        orderId: order.id,
        type: action === "DEDUCT" ? "ORDER_DEDUCTION" : "ORDER_RESTORATION",
        quantityDelta: item.quantity * deltaMultiplier,
        previousStock,
        newStock,
        reason: action === "DEDUCT" ? "Stock deducted when order was confirmed" : "Stock restored after cancellation",
        createdById: actorId,
      },
    });
  }
}

export async function transitionOrderStatus(input: {
  orderId: string;
  toStatus: OrderStatus;
  actorId: string;
  note?: string | null;
}) {
  return serializableTransaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: { select: { productId: true, variantId: true, quantity: true } } },
      });
      if (!order) throw new ValidationError("Order was not found");
      if (order.status === input.toStatus) return order;
      try {
        assertOrderTransition(
          order.fulfillmentMethod as DomainFulfillmentMethod,
          order.status as DomainOrderStatus,
          input.toStatus as DomainOrderStatus,
        );
      } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : "Invalid order transition");
      }

      const action = inventoryActionForTransition(
        {
          deducted: order.inventoryDeductedAt !== null,
          restored: order.inventoryRestoredAt !== null,
        },
        input.toStatus,
      );
      if (action !== "NONE") await mutateStockForOrder(tx, order, action, input.actorId);

      const now = new Date();
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: input.toStatus,
          confirmedAt: input.toStatus === "CONFIRMED" ? (order.confirmedAt ?? now) : undefined,
          inventoryDeductedAt: action === "DEDUCT" ? now : undefined,
          inventoryRestoredAt: action === "RESTORE" ? now : undefined,
          cancelledAt: input.toStatus === "CANCELLED" ? now : undefined,
          completedAt: isCompletedStatus(input.toStatus as DomainOrderStatus) ? now : undefined,
          statusHistory: {
            create: {
              fromStatus: order.status,
              toStatus: input.toStatus,
              changedById: input.actorId,
              note: input.note?.trim() || null,
            },
          },
        },
      });
      return updated;
    },
  );
}

export async function createManualInventoryAdjustment(input: {
  productId: string;
  variantId?: string | null;
  mode?: "DELTA" | "SET_EXACT";
  quantityDelta?: number;
  targetStock?: number;
  reason: string;
  actorId: string;
}) {
  const mode = input.mode ?? "DELTA";
  if (mode === "DELTA" && (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0)) {
    throw new ValidationError("Inventory adjustment must be a non-zero integer");
  }
  if (mode === "SET_EXACT" && (!Number.isInteger(input.targetStock) || (input.targetStock ?? -1) < 0)) {
    throw new ValidationError("Exact stock must be a non-negative integer");
  }
  if (input.reason.trim().length < 3) throw new ValidationError("An adjustment reason is required");

  return serializableTransaction(async (tx) => {
    let previousStock: number;
    if (input.variantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, productId: input.productId },
        select: { id: true, stockQuantity: true },
      });
      if (!variant) throw new ValidationError("Product variant was not found");
      previousStock = variant.stockQuantity;
      const newStock = mode === "SET_EXACT" ? input.targetStock! : previousStock + input.quantityDelta!;
      const quantityDelta = newStock - previousStock;
      if (newStock < 0) throw new ValidationError("Adjustment would create negative stock");
      if (quantityDelta === 0) throw new ValidationError("Adjustment does not change stock");
      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stockQuantity: previousStock },
        data: { stockQuantity: newStock },
      });
      if (updated.count !== 1) throw new ValidationError("Stock changed while the adjustment was being saved");
      return tx.inventoryAdjustment.create({
        data: {
          productId: input.productId,
          variantId: input.variantId,
          type: "MANUAL_CORRECTION",
          quantityDelta,
          previousStock,
          newStock,
          reason: input.reason.trim(),
          createdById: input.actorId,
        },
      });
    } else {
      const product = await tx.product.findUnique({ where: { id: input.productId }, select: { id: true, stockQuantity: true } });
      if (!product) throw new ValidationError("Product was not found");
      previousStock = product.stockQuantity;
      const newStock = mode === "SET_EXACT" ? input.targetStock! : previousStock + input.quantityDelta!;
      const quantityDelta = newStock - previousStock;
      if (newStock < 0) throw new ValidationError("Adjustment would create negative stock");
      if (quantityDelta === 0) throw new ValidationError("Adjustment does not change stock");
      const updated = await tx.product.updateMany({
        where: { id: product.id, stockQuantity: previousStock },
        data: { stockQuantity: newStock },
      });
      if (updated.count !== 1) throw new ValidationError("Stock changed while the adjustment was being saved");
      return tx.inventoryAdjustment.create({
        data: {
          productId: input.productId,
          variantId: null,
          type: "MANUAL_CORRECTION",
          quantityDelta,
          previousStock,
          newStock,
          reason: input.reason.trim(),
          createdById: input.actorId,
        },
      });
    }
  });
}

export async function getCustomerOrders(userId: string, page = 1, pageSize = 20) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const [orders, total] = await db.$transaction([
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentMethod: true,
        subtotal: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where: { userId } }),
  ]);
  return {
    orders: orders.map(({ subtotal, ...order }) => ({ ...order, total: subtotal.toFixed(2) })),
    pagination: { page: safePage, pageSize: safePageSize, total, pageCount: Math.ceil(total / safePageSize) },
  };
}

export async function getCustomerOrder(userId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" }, select: { toStatus: true, note: true, createdAt: true } },
    },
  });
  if (!order) return null;
  const { deliveryFee: historicalDeliveryFee, total: historicalTotal, ...productOnlyOrder } = order;
  void historicalDeliveryFee;
  void historicalTotal;
  return {
    ...productOnlyOrder,
    subtotal: order.subtotal.toFixed(2),
    total: order.subtotal.toFixed(2),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
