import { randomBytes } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type { CheckoutInput } from "@/lib/validation/commerce";
import { ValidationError } from "@/lib/validation/common";
import { getProductAvailability, validateRequestedQuantity } from "./catalog";
import { currencyFromSetting } from "./currency";
import { calculateDeliveryFee } from "./delivery";
import { inventoryActionForTransition } from "./inventory";
import { calculateOrderTotals, minorToMoney, moneyToMinor } from "./money";
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

export async function createOrderFromCart(userId: string, input: CheckoutInput) {
  const order = await db.$transaction(
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
        | { id: string; nameAr: string; nameEn: string; deliveryFee: Prisma.Decimal }
        | null = null;
      let area:
        | { id: string; nameAr: string; nameEn: string; deliveryFee: Prisma.Decimal | null }
        | null = null;
      if (input.fulfillmentMethod === "DELIVERY") {
        city = await tx.city.findFirst({
          where: { id: input.cityId, isActive: true },
          select: { id: true, nameAr: true, nameEn: true, deliveryFee: true },
        });
        if (!city) throw new ValidationError("Selected city is unavailable");
        if (input.areaId) {
          area = await tx.area.findFirst({
            where: { id: input.areaId, cityId: city.id, isActive: true },
            select: { id: true, nameAr: true, nameEn: true, deliveryFee: true },
          });
          if (!area) throw new ValidationError("Selected area is unavailable");
        }
      }

      const lines = cart.items.map((item) => {
        const availability = getProductAvailability({
          status: item.product.status,
          archivedAt: item.product.archivedAt,
          stockQuantity: item.product.stockQuantity,
          hasVariants: item.product.variants.length > 0,
          variant: item.variant
            ? {
                belongsToProduct: item.variant.productId === item.productId,
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
        const unitPrice = item.variant?.priceOverride ?? item.product.price;
        return { item, unitPrice, unitPriceMinor: moneyToMinor(unitPrice), quantity: item.quantity };
      });

      const deliveryFeeMinor =
        input.fulfillmentMethod === "DELIVERY" && city
          ? calculateDeliveryFee({
              fulfillmentMethod: "DELIVERY",
              cityFee: city.deliveryFee,
              areaFee: area?.deliveryFee,
            })
          : 0;
      const totals = calculateOrderTotals(lines, deliveryFeeMinor);
      const now = new Date();
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
          deliveryFee: new Prisma.Decimal(minorToMoney(totals.deliveryFeeMinor)),
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
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
    if (item.variantId) {
      const updated =
        action === "DEDUCT"
          ? await tx.productVariant.updateMany({
              where: { id: item.variantId, productId: item.productId, stockQuantity: { gte: item.quantity } },
              data: { stockQuantity: { decrement: item.quantity } },
            })
          : await tx.productVariant.updateMany({
              where: { id: item.variantId, productId: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
      if (updated.count !== 1) throw new ValidationError("Insufficient stock to confirm this order");
    } else {
      const updated =
        action === "DEDUCT"
          ? await tx.product.updateMany({
              where: { id: item.productId, stockQuantity: { gte: item.quantity } },
              data: { stockQuantity: { decrement: item.quantity } },
            })
          : await tx.product.updateMany({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
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
  return db.$transaction(
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
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createManualInventoryAdjustment(input: {
  productId: string;
  variantId?: string | null;
  quantityDelta: number;
  reason: string;
  actorId: string;
}) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new ValidationError("Inventory adjustment must be a non-zero integer");
  }
  if (input.reason.trim().length < 3) throw new ValidationError("An adjustment reason is required");

  return db.$transaction(async (tx) => {
    if (input.variantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: input.variantId, productId: input.productId },
      });
      if (!variant) {
        throw new ValidationError("Adjustment would create negative stock");
      }
      const updated = await tx.productVariant.updateMany({
        where: {
          id: variant.id,
          ...(input.quantityDelta < 0 ? { stockQuantity: { gte: -input.quantityDelta } } : {}),
        },
        data: { stockQuantity: { increment: input.quantityDelta } },
      });
      if (updated.count !== 1) throw new ValidationError("Adjustment would create negative stock");
    } else {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new ValidationError("Adjustment would create negative stock");
      }
      const updated = await tx.product.updateMany({
        where: {
          id: product.id,
          ...(input.quantityDelta < 0 ? { stockQuantity: { gte: -input.quantityDelta } } : {}),
        },
        data: { stockQuantity: { increment: input.quantityDelta } },
      });
      if (updated.count !== 1) throw new ValidationError("Adjustment would create negative stock");
    }
    return tx.inventoryAdjustment.create({
      data: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        type: "MANUAL_CORRECTION",
        quantityDelta: input.quantityDelta,
        reason: input.reason.trim(),
        createdById: input.actorId,
      },
    });
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
        total: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where: { userId } }),
  ]);
  return {
    orders: orders.map((order) => ({ ...order, total: order.total.toFixed(2) })),
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
  return {
    ...order,
    subtotal: order.subtotal.toFixed(2),
    deliveryFee: order.deliveryFee.toFixed(2),
    total: order.total.toFixed(2),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
  };
}
