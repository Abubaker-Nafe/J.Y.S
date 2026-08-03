import { db } from "@/lib/db";
import { ValidationError } from "@/lib/validation/common";
import { resolveSalePricing } from "./pricing";

const wishlistInclude = {
  product: {
    include: {
      images: { orderBy: { displayOrder: "asc" as const }, take: 1 },
      variants: { select: { stockQuantity: true, isActive: true, isAvailable: true } },
    },
  },
};

export async function getWishlist(userId: string) {
  const items = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: wishlistInclude,
  });
  return items.map((item) => {
    const pricing = resolveSalePricing({ normalPrice: item.product.price, isOnSale: item.product.isOnSale, salePrice: item.product.salePrice, saleStartsAt: item.product.saleStartsAt, saleEndsAt: item.product.saleEndsAt, productActive: item.product.status === "ACTIVE" && item.product.isAvailable, archived: Boolean(item.product.archivedAt) });
    return ({
    id: item.id,
    productId: item.productId,
    createdAt: item.createdAt,
    product: {
      id: item.product.id,
      nameAr: item.product.nameAr,
      nameEn: item.product.nameEn,
      price: item.product.price.toFixed(2),
      effectivePrice: pricing.effectivePrice,
      onSale: pricing.isOnSale,
      discountPercentage: pricing.discountPercentage,
      imageUrl: item.product.images[0]?.url ?? null,
      isAvailable:
        item.product.status === "ACTIVE" &&
        !item.product.archivedAt &&
        item.product.isAvailable &&
        (item.product.variants.length > 0
          ? item.product.variants.some((variant) => variant.isActive && variant.isAvailable && variant.stockQuantity > 0)
          : item.product.stockQuantity > 0),
    },
  });
  });
}

export async function addWishlistItem(userId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE", archivedAt: null, isAvailable: true },
    select: { id: true },
  });
  if (!product) throw new ValidationError("Product was not found");
  await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
  return getWishlist(userId);
}

export async function removeWishlistItem(userId: string, productId: string) {
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
  return getWishlist(userId);
}

