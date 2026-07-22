import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createManualInventoryAdjustment, transitionOrderStatus } from "@/lib/domain/order-service";
import { AdminDomainError } from "./api";
import { areaMoveConflictsWithAddresses } from "./location-rules";
import type {
  CategoryMutation,
  ContentMutation,
  InventoryAdjustmentMutation,
  LocationMutation,
  OrderMutation,
  ProductMutation,
  SettingsMutation,
} from "./schemas";

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, ...(metadata === undefined ? {} : { metadata }) } });
}

function productMetadataData(input: ProductMutation) {
  return {
    sku: input.sku,
    slug: input.slug,
    nameAr: input.nameAr,
    nameEn: input.nameEn,
    descriptionAr: input.descriptionAr,
    descriptionEn: input.descriptionEn,
    price: input.price,
    lowStockThreshold: input.lowStockThreshold,
    categoryId: input.categoryId,
    status: input.active ? "ACTIVE" as const : "HIDDEN" as const,
    isFeatured: input.featured,
  };
}

function productData(input: ProductMutation) {
  return { ...productMetadataData(input), stockQuantity: input.stock };
}

function imageData(image: ProductMutation["images"][number]) {
  return {
    storageKey: image.storageKey,
    url: image.url,
    altAr: image.altAr || null,
    altEn: image.altEn || null,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    displayOrder: image.position,
    isPrimary: image.primary,
  };
}

function variantMetadataData(variant: ProductMutation["variants"][number], displayOrder: number) {
  return { sku: variant.sku, labelAr: variant.labelAr, labelEn: variant.labelEn, priceOverride: variant.priceOverride, isAvailable: variant.active, displayOrder };
}

function variantData(variant: ProductMutation["variants"][number], displayOrder: number) {
  return { ...variantMetadataData(variant, displayOrder), stockQuantity: variant.stock };
}

export async function createProduct(input: ProductMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.findFirst({ where: { id: input.categoryId, archivedAt: null }, select: { id: true } });
    if (!category) throw new AdminDomainError("Select an active category.", 422);
    const product = await tx.product.create({
      data: {
        ...productData(input),
        images: { create: input.images.map(imageData) },
        variants: { create: input.variants.map(variantData) },
      },
      select: { id: true, variants: { select: { id: true, stockQuantity: true } } },
    });
    const initialAdjustments = [
      ...(input.stock > 0 ? [{ productId: product.id, variantId: null, type: "INITIAL_STOCK" as const, quantityDelta: input.stock, reason: "Initial product stock", createdById: actorId }] : []),
      ...product.variants.filter((variant) => variant.stockQuantity > 0).map((variant) => ({ productId: product.id, variantId: variant.id, type: "INITIAL_STOCK" as const, quantityDelta: variant.stockQuantity, reason: "Initial variant stock", createdById: actorId })),
    ];
    if (initialAdjustments.length) await tx.inventoryAdjustment.createMany({ data: initialAdjustments });
    await audit(tx, actorId, "PRODUCT_CREATED", "Product", product.id, { sku: input.sku });
    return product;
  });
}

export async function updateProduct(id: string, input: ProductMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, select: { id: true, archivedAt: true, variants: { select: { id: true } } } });
    if (!current) throw new AdminDomainError("Product not found.", 404);
    if (current.archivedAt) throw new AdminDomainError("Restore this product before editing it.", 409);
    const requestedVariantIds = input.variants.flatMap((variant) => variant.id ? [variant.id] : []);
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productVariant.updateMany({
      where: { productId: id, id: { notIn: requestedVariantIds } },
      data: { isAvailable: false, displayOrder: input.variants.length + 100 },
    });
    for (const [index, variant] of input.variants.entries()) {
      if (variant.id) {
        // Stock is intentionally excluded: metadata edits must never overwrite
        // a concurrent order deduction. All existing-stock changes go through
        // the conditional, ledger-backed inventory adjustment endpoint.
        const updated = await tx.productVariant.updateMany({ where: { id: variant.id, productId: id }, data: variantMetadataData(variant, index) });
        if (updated.count !== 1) throw new AdminDomainError("A product variant no longer exists. Reload and try again.", 409);
      } else {
        const created = await tx.productVariant.create({ data: { productId: id, ...variantData(variant, index) }, select: { id: true } });
        if (variant.stock > 0) await tx.inventoryAdjustment.create({ data: { productId: id, variantId: created.id, type: "INITIAL_STOCK", quantityDelta: variant.stock, reason: "Initial stock for newly created variant", createdById: actorId } });
      }
    }
    const product = await tx.product.update({ where: { id }, data: { ...productMetadataData(input), images: { create: input.images.map(imageData) } }, select: { id: true } });
    await audit(tx, actorId, "PRODUCT_UPDATED", "Product", id, { sku: input.sku, inventoryPreserved: true });
    return product;
  });
}

export async function setProductArchived(id: string, archived: boolean, actorId: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: archived ? { archivedAt: new Date(), status: "ARCHIVED", isFeatured: false } : { archivedAt: null, status: "HIDDEN" }, select: { id: true } });
    await audit(tx, actorId, archived ? "PRODUCT_ARCHIVED" : "PRODUCT_RESTORED", "Product", id);
    return product;
  });
}

export async function createCategory(input: CategoryMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { nameAr: input.nameAr, nameEn: input.nameEn, descriptionAr: input.descriptionAr || null, descriptionEn: input.descriptionEn || null, slug: input.slug, isActive: input.active, displayOrder: input.displayOrder }, select: { id: true } });
    await audit(tx, actorId, "CATEGORY_CREATED", "Category", category.id);
    return category;
  });
}

export async function updateCategory(id: string, input: CategoryMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.update({ where: { id }, data: { nameAr: input.nameAr, nameEn: input.nameEn, descriptionAr: input.descriptionAr || null, descriptionEn: input.descriptionEn || null, slug: input.slug, isActive: input.active, displayOrder: input.displayOrder }, select: { id: true } });
    await audit(tx, actorId, "CATEGORY_UPDATED", "Category", category.id);
    return category;
  });
}

export async function archiveCategory(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.update({ where: { id }, data: { archivedAt: new Date(), isActive: false }, select: { id: true } });
    await audit(tx, actorId, "CATEGORY_ARCHIVED", "Category", id);
    return category;
  });
}

export async function restoreCategory(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const category = await tx.category.update({ where: { id }, data: { archivedAt: null, isActive: false }, select: { id: true } });
    await audit(tx, actorId, "CATEGORY_RESTORED", "Category", id);
    return category;
  });
}

export async function adjustInventory(input: InventoryAdjustmentMutation, actorId: string) {
  const adjustment = await createManualInventoryAdjustment({ ...input, actorId });
  await db.auditLog.create({ data: { actorId, action: "INVENTORY_ADJUSTED", entityType: "InventoryAdjustment", entityId: adjustment.id, metadata: { productId: input.productId, variantId: input.variantId ?? null, quantityDelta: input.quantityDelta } } });
  return adjustment;
}

export async function updateOrder(id: string, input: OrderMutation, actorId: string) {
  const order = await db.order.findUnique({ where: { id }, select: { id: true, status: true, paymentStatus: true } });
  if (!order) throw new AdminDomainError("Order not found.", 404);
  if (input.paymentStatus) {
    return db.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({ where: { id, paymentStatus: order.paymentStatus }, data: { paymentStatus: input.paymentStatus } });
      if (changed.count !== 1) throw new AdminDomainError("This order changed while you were editing it. Reload and try again.", 409);
      await audit(tx, actorId, "ORDER_PAYMENT_STATUS_UPDATED", "Order", id, { from: order.paymentStatus, to: input.paymentStatus, note: input.note ?? null });
      return tx.order.findUniqueOrThrow({ where: { id }, select: { id: true } });
    });
  }
  if (!input.status) throw new AdminDomainError("Choose an order status.", 422);
  const updated = await transitionOrderStatus({ orderId: id, toStatus: input.status, actorId, note: input.note });
  await db.auditLog.create({ data: { actorId, action: "ORDER_STATUS_UPDATED", entityType: "Order", entityId: id, metadata: { from: order.status, to: input.status } } });
  return updated;
}

export async function saveLocation(id: string | null, input: LocationMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    if (input.kind === "city") {
      const data = { nameAr: input.nameAr, nameEn: input.nameEn, slug: input.slug, deliveryFee: input.deliveryFee, isActive: input.active, displayOrder: input.displayOrder };
      const city = id ? await tx.city.update({ where: { id }, data, select: { id: true } }) : await tx.city.create({ data, select: { id: true } });
      await audit(tx, actorId, id ? "CITY_UPDATED" : "CITY_CREATED", "City", city.id);
      return city;
    }
    const data = { cityId: input.cityId, nameAr: input.nameAr, nameEn: input.nameEn, slug: input.slug, deliveryFee: input.deliveryFee, isActive: input.active, displayOrder: input.displayOrder };
    if (id) {
      const existing = await tx.area.findUnique({
        where: { id },
        select: { cityId: true, _count: { select: { addresses: true } } },
      });
      if (!existing) throw new AdminDomainError("Area not found.", 404);
      if (areaMoveConflictsWithAddresses(existing.cityId, input.cityId, existing._count.addresses)) {
        throw new AdminDomainError(
          "This area is used by customer addresses and cannot be moved to another city. Create a new area or update those addresses first.",
          409,
        );
      }
    }
    const area = id ? await tx.area.update({ where: { id }, data, select: { id: true } }) : await tx.area.create({ data, select: { id: true } });
    await audit(tx, actorId, id ? "AREA_UPDATED" : "AREA_CREATED", "Area", area.id);
    return area;
  });
}

export async function saveContent(input: ContentMutation, actorId: string) {
  const fixedSlugs: Record<ContentMutation["type"], string> = {
    TERMS: "terms",
    PRIVACY: "privacy",
    NO_RETURN: "no-returns",
    WARRANTY: "warranty",
    DELIVERY: "delivery",
    PICKUP: "pickup",
  };
  const slug = fixedSlugs[input.type];
  return db.$transaction(async (tx) => {
    const page = await tx.contentPage.upsert({ where: { type: input.type }, create: { type: input.type, slug, titleAr: input.titleAr, titleEn: input.titleEn, bodyAr: input.bodyAr, bodyEn: input.bodyEn, isPublished: input.active, publishedAt: input.active ? new Date() : null }, update: { slug, titleAr: input.titleAr, titleEn: input.titleEn, bodyAr: input.bodyAr, bodyEn: input.bodyEn, isPublished: input.active, publishedAt: input.active ? new Date() : null }, select: { id: true } });
    await audit(tx, actorId, "CONTENT_UPDATED", "ContentPage", page.id, { type: input.type });
    return page;
  });
}

export async function saveSettings(input: SettingsMutation, actorId: string) {
  return db.$transaction(async (tx) => {
    for (const setting of input.settings) {
      await tx.siteSetting.upsert({ where: { key: setting.key }, create: { key: setting.key, value: setting.value as Prisma.InputJsonValue, description: setting.description || null, isPublic: setting.isPublic, updatedById: actorId }, update: { value: setting.value as Prisma.InputJsonValue, description: setting.description || null, isPublic: setting.isPublic, updatedById: actorId } });
    }
    await audit(tx, actorId, "SETTINGS_UPDATED", "SiteSetting", null, { keys: input.settings.map((setting) => setting.key) });
    return { count: input.settings.length };
  });
}
