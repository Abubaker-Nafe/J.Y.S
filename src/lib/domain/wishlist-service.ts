import { db } from "@/lib/db";
import { ValidationError } from "@/lib/validation/common";

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
  return items.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    product: {
      id: item.product.id,
      slug: item.product.slug,
      nameAr: item.product.nameAr,
      nameEn: item.product.nameEn,
      price: item.product.price.toFixed(2),
      imageUrl: item.product.images[0]?.url ?? null,
      isAvailable:
        item.product.status === "ACTIVE" &&
        !item.product.archivedAt &&
        item.product.isAvailable &&
        (item.product.variants.length > 0
          ? item.product.variants.some((variant) => variant.isActive && variant.isAvailable && variant.stockQuantity > 0)
          : item.product.stockQuantity > 0),
    },
  }));
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

