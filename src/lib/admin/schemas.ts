import { z } from "zod";

const bilingualShort = z.string().trim().min(1).max(180);
const bilingualLong = z.string().trim().min(1).max(20_000);
const money = z.coerce.number().finite().min(0).max(10_000_000);
const quantity = z.coerce.number().int().min(0).max(10_000_000);
const cuid = z.string().trim().min(1).max(64);
const slug = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const safeStorageKey = z.string().regex(/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif)$/);

export const productImageSchema = z.object({
  id: z.string().max(255).optional(),
  storageKey: safeStorageKey,
  url: z.string().trim().startsWith("/").max(2_000),
  altAr: z.string().trim().max(300),
  altEn: z.string().trim().max(300),
  position: z.number().int().min(0).max(100),
  primary: z.boolean(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  sizeBytes: z.number().int().min(1).max(20 * 1_048_576),
});

export const productVariantSchema = z.object({
  id: z.string().max(64).optional(),
  sku: z.string().trim().min(1).max(80),
  labelAr: bilingualShort,
  labelEn: bilingualShort,
  priceOverride: money.nullable(),
  stock: quantity,
  available: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const productMutationSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  slug,
  nameAr: bilingualShort,
  nameEn: bilingualShort,
  descriptionAr: bilingualLong,
  descriptionEn: bilingualLong,
  price: money,
  stock: quantity,
  lowStockThreshold: quantity.max(100_000),
  categoryId: cuid,
  available: z.boolean().default(true),
  active: z.boolean(),
  featured: z.boolean(),
  images: z.array(productImageSchema).max(12).superRefine((images, context) => {
    if (images.filter((image) => image.primary).length > 1) context.addIssue({ code: "custom", message: "Only one primary image is allowed" });
  }),
  variants: z.array(productVariantSchema).max(100).superRefine((variants, context) => {
    const skus = new Set<string>();
    variants.forEach((variant, index) => {
      const normalized = variant.sku.toLocaleUpperCase("en");
      if (skus.has(normalized)) context.addIssue({ code: "custom", path: [index, "sku"], message: "Variant SKUs must be unique" });
      skus.add(normalized);
    });
  }),
});

export const categoryMutationSchema = z.object({
  nameAr: bilingualShort,
  nameEn: bilingualShort,
  descriptionAr: z.string().trim().max(2_000),
  descriptionEn: z.string().trim().max(2_000),
  slug,
  active: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
});

export const inventoryAdjustmentSchema = z.object({
  productId: cuid,
  variantId: cuid.nullable().optional(),
  mode: z.enum(["DELTA", "SET_EXACT"]).default("DELTA"),
  quantityDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional(),
  targetStock: z.coerce.number().int().min(0).max(10_000_000).optional(),
  reason: z.string().trim().min(3).max(500),
}).superRefine((value, context) => {
  if (value.mode === "DELTA" && (!value.quantityDelta || value.quantityDelta === 0)) {
    context.addIssue({ code: "custom", path: ["quantityDelta"], message: "Adjustment cannot be zero" });
  }
  if (value.mode === "SET_EXACT" && value.targetStock === undefined) {
    context.addIssue({ code: "custom", path: ["targetStock"], message: "Exact stock value is required" });
  }
});

export const orderMutationSchema = z.object({
  status: z.enum(["NEW", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY", "SENT_TO_DELIVERY_COMPANY", "DELIVERED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "CANCELLED"]).optional(),
  note: z.string().trim().max(1_000).optional(),
}).refine((value) => Boolean(value.status) !== Boolean(value.paymentStatus), "Change either order status or payment status in one request");

export const locationMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("city"), nameAr: bilingualShort, nameEn: bilingualShort, slug, deliveryFee: money, active: z.boolean(), displayOrder: z.coerce.number().int().min(0).max(100_000) }),
  z.object({ kind: z.literal("area"), cityId: cuid, nameAr: bilingualShort, nameEn: bilingualShort, slug, deliveryFee: money.nullable(), active: z.boolean(), displayOrder: z.coerce.number().int().min(0).max(100_000) }),
]);

export const contentMutationSchema = z.object({
  type: z.enum(["TERMS", "PRIVACY", "NO_RETURN", "WARRANTY", "DELIVERY", "PICKUP"]),
  slug,
  titleAr: bilingualShort,
  titleEn: bilingualShort,
  bodyAr: bilingualLong,
  bodyEn: bilingualLong,
  active: z.boolean(),
});

const settingMeta = { description: z.string().trim().max(500), isPublic: z.boolean() };
const settingsEntrySchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("store.profile"), value: z.object({ nameAr: bilingualShort, nameEn: bilingualShort, phone: z.string().trim().min(7).max(30), email: z.string().trim().email().max(254) }).strict(), ...settingMeta }).strict(),
  z.object({ key: z.literal("store.location"), value: z.object({ addressAr: bilingualShort, addressEn: bilingualShort, mapUrl: z.union([z.literal(""), z.string().url().max(2_000)]) }).strict(), ...settingMeta }).strict(),
  z.object({ key: z.literal("store.openingHours"), value: z.object({ ar: bilingualShort, en: bilingualShort }).strict(), ...settingMeta }).strict(),
  z.object({ key: z.literal("commerce.currency"), value: z.object({ code: z.string().regex(/^[A-Z]{3}$/), symbolAr: z.string().trim().min(1).max(8), symbolEn: z.string().trim().min(1).max(8) }).strict(), ...settingMeta }).strict(),
  z.object({ key: z.literal("inventory.defaultLowStockThreshold"), value: z.number().int().min(0).max(100_000), ...settingMeta }).strict(),
  z.object({ key: z.literal("homepage.promotion"), value: z.object({ titleAr: bilingualShort, titleEn: bilingualShort, bodyAr: z.string().trim().min(1).max(1_000), bodyEn: z.string().trim().min(1).max(1_000), imageUrl: z.union([z.literal(""), z.string().startsWith("/").max(2_000)]) }).strict(), ...settingMeta }).strict(),
]);
export const settingsMutationSchema = z.object({ settings: z.array(settingsEntrySchema).min(1).max(6) }).strict();

export const reportQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: z.enum(["FULFILLED", "ALL", "NEW", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY", "SENT_TO_DELIVERY_COMPANY", "DELIVERED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"]).default("FULFILLED"),
  categoryId: z.string().trim().max(64).optional().default(""),
  fulfillment: z.enum(["ALL", "DELIVERY", "PICKUP"]).default("ALL"),
  payment: z.enum(["ALL", "CASH_ON_DELIVERY", "CASH_ON_PICKUP"]).default("ALL"),
  paymentStatus: z.enum(["ALL", "PENDING", "PAID", "CANCELLED"]).default("ALL"),
  group: z.enum(["day", "week", "month"]).default("day"),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { path: ["to"], message: "End date must not precede start date" });

export type ProductMutation = z.infer<typeof productMutationSchema>;
export type CategoryMutation = z.infer<typeof categoryMutationSchema>;
export type InventoryAdjustmentMutation = z.infer<typeof inventoryAdjustmentSchema>;
export type OrderMutation = z.infer<typeof orderMutationSchema>;
export type LocationMutation = z.infer<typeof locationMutationSchema>;
export type ContentMutation = z.infer<typeof contentMutationSchema>;
export type SettingsMutation = z.infer<typeof settingsMutationSchema>;
