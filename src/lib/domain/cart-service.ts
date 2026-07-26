import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/validation/common";
import type { AddCartItemInput } from "@/lib/validation/commerce";
import { getProductAvailability, validateRequestedQuantity } from "./catalog";
import { currencyFromSetting } from "./currency";
import { minorToMoney, moneyToMinor } from "./money";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        include: {
          images: { orderBy: { displayOrder: "asc" as const }, take: 1 },
          variants: { select: { id: true } },
        },
      },
      variant: true,
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

async function activeCart(userId: string): Promise<CartWithItems | null> {
  return db.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: cartInclude,
  });
}

function serializeCart(cart: CartWithItems | null, currency: string) {
  const issues: Array<{ itemId: string; code: string }> = [];
  const items = (cart?.items ?? []).map((item) => {
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
    const currentPrice = item.variant?.priceOverride ?? item.product.price;
    const unitPriceMinor = moneyToMinor(currentPrice);
    const priceChanged = !currentPrice.equals(item.priceSnapshot);
    const isAvailable = availability.available && item.quantity <= availability.availableStock;
    if (!isAvailable) issues.push({ itemId: item.id, code: "UNAVAILABLE_OR_LOW_STOCK" });
    if (priceChanged) issues.push({ itemId: item.id, code: "PRICE_CHANGED" });
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: minorToMoney(unitPriceMinor),
      lineTotal: minorToMoney(unitPriceMinor * item.quantity),
      priceChanged,
      availableStock: availability.available ? availability.availableStock : 0,
      isAvailable,
      product: {
        slug: item.product.slug,
        nameAr: item.product.nameAr,
        nameEn: item.product.nameEn,
        imageUrl: item.product.images[0]?.url ?? null,
        variantLabelAr: item.variant?.labelAr ?? null,
        variantLabelEn: item.variant?.labelEn ?? null,
      },
    };
  });
  const subtotalMinor = items.reduce((sum, item) => sum + moneyToMinor(item.lineTotal), 0);
  return {
    id: cart?.id ?? null,
    items,
    subtotal: minorToMoney(subtotalMinor),
    currency,
    issues,
  };
}

export async function getCart(userId: string) {
  const [cart, currencySetting] = await Promise.all([
    activeCart(userId),
    db.siteSetting.findUnique({ where: { key: "commerce.currency" }, select: { value: true } }),
  ]);
  return serializeCart(cart, currencyFromSetting(currencySetting?.value));
}

export async function addCartItem(userId: string, input: AddCartItemInput) {
  await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      include: { variants: true },
    });
    if (!product) throw new ValidationError("Product was not found");
    const variant = input.variantId
      ? product.variants.find((candidate) => candidate.id === input.variantId)
      : null;
    const availability = getProductAvailability({
      status: product.status,
      archivedAt: product.archivedAt,
      isAvailable: product.isAvailable,
      stockQuantity: product.stockQuantity,
      hasVariants: product.variants.length > 0,
      variant: variant
        ? {
            belongsToProduct: true,
            isActive: variant.isActive,
            isAvailable: variant.isAvailable,
            stockQuantity: variant.stockQuantity,
          }
        : null,
    });
    if (!availability.available) throw new ValidationError(`Product cannot be added: ${availability.reason}`);

    const cart =
      (await tx.cart.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { updatedAt: "desc" } })) ??
      (await tx.cart.create({ data: { userId } }));
    const targetKey = variant ? `variant:${variant.id}` : `product:${product.id}`;
    const existing = await tx.cartItem.findUnique({
      where: { cartId_targetKey: { cartId: cart.id, targetKey } },
    });
    const quantity = (existing?.quantity ?? 0) + input.quantity;
    validateRequestedQuantity(quantity, availability.availableStock);
    const price = variant?.priceOverride ?? product.price;
    await tx.cartItem.upsert({
      where: { cartId_targetKey: { cartId: cart.id, targetKey } },
      create: {
        cartId: cart.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        targetKey,
        quantity,
        priceSnapshot: price,
      },
      update: { quantity, priceSnapshot: price },
    });
  });
  return getCart(userId);
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  await db.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: { userId, status: "ACTIVE" } },
      include: { product: { include: { variants: true } }, variant: true },
    });
    if (!item) throw new ValidationError("Cart item was not found");
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
    if (!availability.available) throw new ValidationError("This product is no longer available");
    validateRequestedQuantity(quantity, availability.availableStock);
    await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
  });
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const removed = await db.cartItem.deleteMany({
    where: { id: itemId, cart: { userId, status: "ACTIVE" } },
  });
  if (removed.count === 0) throw new ValidationError("Cart item was not found");
  return getCart(userId);
}
