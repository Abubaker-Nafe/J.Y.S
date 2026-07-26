import { z } from "zod";

const decimalMoneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value), "Invalid money amount");

export const productInputSchema = z
  .object({
    categoryId: z.string().min(1).max(64),
    slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
    nameAr: z.string().trim().min(2).max(200),
    nameEn: z.string().trim().min(2).max(200),
    descriptionAr: z.string().trim().min(2).max(20_000),
    descriptionEn: z.string().trim().min(2).max(20_000),
    price: decimalMoneySchema,
    stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
    lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
    status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "ARCHIVED"]).default("DRAFT"),
    isAvailable: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
  })
  .strict();

export const variantInputSchema = z
  .object({
    sku: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/),
    labelAr: z.string().trim().min(1).max(120),
    labelEn: z.string().trim().min(1).max(120),
    attributes: z.record(z.string(), z.string().max(200)).default({}),
    priceOverride: decimalMoneySchema.nullish(),
    stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
    isActive: z.boolean().default(true),
    isAvailable: z.boolean().default(true),
  })
  .strict();

export const categoryInputSchema = z
  .object({
    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameAr: z.string().trim().min(1).max(120),
    nameEn: z.string().trim().min(1).max(120),
    descriptionAr: z.string().trim().max(2_000).nullish(),
    descriptionEn: z.string().trim().max(2_000).nullish(),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).max(100_000).default(0),
  })
  .strict();

