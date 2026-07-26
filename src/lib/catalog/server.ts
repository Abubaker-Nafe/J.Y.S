import "server-only";

import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { demoCategories, demoProducts, type Category, type Product } from "@/lib/demo/catalog";
import type { StorefrontSort } from "./query";

export type StorefrontCatalogSource = "database" | "demo" | "unavailable";

export interface StorefrontCatalog {
  products: Product[];
  categories: Category[];
  source: StorefrontCatalogSource;
  unavailableReason?: "not-configured" | "query-failed";
}

export interface StorefrontCategories {
  categories: Category[];
  source: StorefrontCatalogSource;
  unavailableReason?: "not-configured" | "query-failed";
}

export interface StorefrontProductQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  category?: string;
  available?: boolean;
  sort?: StorefrontSort;
}

export interface StorefrontProductPage extends StorefrontCatalog {
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface StorefrontProductDetail {
  product?: Product;
  category?: Category;
  related: Product[];
  source: StorefrontCatalogSource;
  unavailableReason?: "not-configured" | "query-failed";
}

const categoryAccents = ["#c8783e", "#64748b", "#b08b57", "#66785f", "#6f7d94", "#8a6b61"];
const productKinds: Record<string, Product["visual"]["kind"]> = { clippers: "clipper", styling: "jar", "beard-care": "bottle", shaving: "razor", tools: "comb", salon: "brush" };
const productInclude = {
  category: { select: { slug: true } },
  images: { orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }] },
  variants: { orderBy: { displayOrder: "asc" as const } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function configured() {
  return process.env.E2E_DEMO_CATALOG !== "true" && Boolean(process.env.DATABASE_URL);
}

function unavailableReason(): "not-configured" | "query-failed" {
  return configured() ? "query-failed" : "not-configured";
}

function mapCategory(row: { id: string; slug: string; nameAr: string; nameEn: string; descriptionAr: string | null; descriptionEn: string | null }, index: number): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: { ar: row.nameAr, en: row.nameEn },
    description: { ar: row.descriptionAr || row.descriptionEn || "", en: row.descriptionEn || row.descriptionAr || "" },
    accent: categoryAccents[index % categoryAccents.length] ?? "#7d272d",
  };
}

function mapProduct(product: ProductRow, categories: Category[]): Product {
  const categoryIndex = Math.max(0, categories.findIndex((category) => category.slug === product.category.slug));
  const accent = categoryAccents[categoryIndex % categoryAccents.length] ?? "#756556";
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: { ar: product.nameAr, en: product.nameEn },
    description: { ar: product.descriptionAr, en: product.descriptionEn },
    categorySlug: product.category.slug,
    price: Number(product.price),
    stock: product.variants.length
      ? product.variants.filter((variant) => variant.isActive && variant.isAvailable).reduce((total, variant) => total + variant.stockQuantity, 0)
      : product.stockQuantity,
    featured: product.isFeatured,
    createdAt: product.createdAt.toISOString(),
    images: product.images.map((image) => image.url),
    imageAlts: product.images.map((image) => ({ ar: image.altAr || product.nameAr, en: image.altEn || product.nameEn })),
    variants: product.variants.filter((variant) => variant.isActive).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      label: { ar: variant.labelAr, en: variant.labelEn },
      ...(variant.priceOverride === null ? {} : { price: Number(variant.priceOverride) }),
      stock: variant.stockQuantity,
      available: variant.isAvailable,
    })),
    visual: {
      from: "#202225",
      to: accent,
      kind: productKinds[product.category.slug] ?? "bottle",
      ...(product.images[0]?.url ? { image: product.images[0].url } : {}),
    },
  };
}

function normalizeQuery(input: StorefrontProductQuery) {
  return {
    page: Number.isFinite(input.page) ? Math.max(1, Math.trunc(input.page ?? 1)) : 1,
    pageSize: Number.isFinite(input.pageSize) ? Math.min(48, Math.max(1, Math.trunc(input.pageSize ?? 8))) : 8,
    q: input.q?.trim().slice(0, 100) ?? "",
    category: input.category?.trim().slice(0, 100) ?? "",
    available: input.available === true,
    sort: input.sort ?? "featured",
  };
}

function demoProductPage(input: StorefrontProductQuery): StorefrontProductPage {
  const query = normalizeQuery(input);
  const needle = query.q.toLocaleLowerCase();
  const products = demoProducts.filter((product) => {
    if (query.category && product.categorySlug !== query.category) return false;
    if (query.available && product.stock <= 0) return false;
    return !needle || `${product.name.ar} ${product.name.en} ${product.sku}`.toLocaleLowerCase().includes(needle);
  });
  products.sort((left, right) => {
    if (query.sort === "low") return left.price - right.price;
    if (query.sort === "high") return right.price - left.price;
    if (query.sort === "newest") return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return Number(right.featured) - Number(left.featured) || Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
  const total = products.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  return {
    products: products.slice((page - 1) * query.pageSize, page * query.pageSize),
    categories: demoCategories,
    source: "demo",
    pagination: { page, pageSize: query.pageSize, total, pageCount },
  };
}

export const getStorefrontCategories = cache(async (): Promise<StorefrontCategories> => {
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") return { categories: demoCategories, source: "demo" };
    return { categories: [], source: "unavailable", unavailableReason: "not-configured" };
  }
  try {
    const rows = await db.category.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, slug: true, nameAr: true, nameEn: true, descriptionAr: true, descriptionEn: true },
    });
    return { categories: rows.map(mapCategory), source: "database" };
  } catch (error) {
    console.error("Storefront category query failed", error);
    return { categories: [], source: "unavailable", unavailableReason: "query-failed" };
  }
});

export async function getStorefrontProductsPage(input: StorefrontProductQuery = {}): Promise<StorefrontProductPage> {
  const query = normalizeQuery(input);
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") return demoProductPage(query);
    return { products: [], categories: [], source: "unavailable", unavailableReason: "not-configured", pagination: { page: 1, pageSize: query.pageSize, total: 0, pageCount: 1 } };
  }
  try {
    const categoryResult = await getStorefrontCategories();
    if (categoryResult.source === "unavailable") {
      return { products: [], categories: [], source: "unavailable", unavailableReason: categoryResult.unavailableReason, pagination: { page: 1, pageSize: query.pageSize, total: 0, pageCount: 1 } };
    }
    const filters: Prisma.ProductWhereInput[] = [];
    if (query.q) filters.push({ OR: [
      { nameAr: { contains: query.q, mode: "insensitive" } },
      { nameEn: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
    ] });
    if (query.available) filters.push({ OR: [
      { variants: { some: { isActive: true, isAvailable: true, stockQuantity: { gt: 0 } } } },
      { variants: { none: {} }, stockQuantity: { gt: 0 } },
    ] });
    const where: Prisma.ProductWhereInput = {
      status: "ACTIVE",
      isAvailable: true,
      archivedAt: null,
      category: { isActive: true, archivedAt: null, ...(query.category ? { slug: query.category } : {}) },
      ...(filters.length ? { AND: filters } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === "low"
      ? [{ price: "asc" }, { createdAt: "desc" }]
      : query.sort === "high"
        ? [{ price: "desc" }, { createdAt: "desc" }]
        : query.sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ isFeatured: "desc" }, { createdAt: "desc" }];
    const result = await db.$transaction(async (tx) => {
      const total = await tx.product.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, pageCount);
      const rows = await tx.product.findMany({ where, orderBy, skip: (page - 1) * query.pageSize, take: query.pageSize, include: productInclude });
      return { total, pageCount, page, rows };
    });
    return {
      products: result.rows.map((product) => mapProduct(product, categoryResult.categories)),
      categories: categoryResult.categories,
      source: "database",
      pagination: { page: result.page, pageSize: query.pageSize, total: result.total, pageCount: result.pageCount },
    };
  } catch (error) {
    console.error("Storefront paged product query failed", error);
    return { products: [], categories: [], source: "unavailable", unavailableReason: unavailableReason(), pagination: { page: 1, pageSize: query.pageSize, total: 0, pageCount: 1 } };
  }
}

export const getStorefrontCatalog = cache(async (): Promise<StorefrontCatalog> => {
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") return { products: demoProducts, categories: demoCategories, source: "demo" };
    return { products: [], categories: [], source: "unavailable", unavailableReason: "not-configured" };
  }
  try {
    const categoryResult = await getStorefrontCategories();
    if (categoryResult.source === "unavailable") return { products: [], categories: [], source: "unavailable", unavailableReason: categoryResult.unavailableReason };
    const rows = await db.product.findMany({
      where: { status: "ACTIVE", isAvailable: true, archivedAt: null, category: { isActive: true, archivedAt: null } },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      include: productInclude,
    });
    return { products: rows.map((product) => mapProduct(product, categoryResult.categories)), categories: categoryResult.categories, source: "database" };
  } catch (error) {
    console.error("Storefront catalog query failed", error);
    return { products: [], categories: [], source: "unavailable", unavailableReason: "query-failed" };
  }
});

export const getStorefrontHomeCatalog = cache(async (): Promise<StorefrontCatalog> => {
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") return { products: demoProducts.filter((product) => product.featured).slice(0, 4), categories: demoCategories, source: "demo" };
    return { products: [], categories: [], source: "unavailable", unavailableReason: "not-configured" };
  }
  try {
    const categoryResult = await getStorefrontCategories();
    if (categoryResult.source === "unavailable") return { products: [], categories: [], source: "unavailable", unavailableReason: categoryResult.unavailableReason };
    const rows = await db.product.findMany({
      where: { status: "ACTIVE", isAvailable: true, archivedAt: null, isFeatured: true, category: { isActive: true, archivedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: productInclude,
    });
    return { products: rows.map((product) => mapProduct(product, categoryResult.categories)), categories: categoryResult.categories, source: "database" };
  } catch (error) {
    console.error("Storefront home product query failed", error);
    return { products: [], categories: [], source: "unavailable", unavailableReason: "query-failed" };
  }
});

export const getStorefrontProduct = cache(async (slug: string): Promise<StorefrontProductDetail> => {
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") {
      const product = demoProducts.find((item) => item.slug === slug);
      const category = product ? demoCategories.find((item) => item.slug === product.categorySlug) : undefined;
      const related = product ? demoProducts.filter((item) => item.id !== product.id && item.categorySlug === product.categorySlug).slice(0, 4) : [];
      return { product, category, related, source: "demo" };
    }
    return { related: [], source: "unavailable", unavailableReason: "not-configured" };
  }
  try {
    const categoryResult = await getStorefrontCategories();
    if (categoryResult.source === "unavailable") return { related: [], source: "unavailable", unavailableReason: categoryResult.unavailableReason };
    const row = await db.product.findFirst({
      where: { slug, status: "ACTIVE", isAvailable: true, archivedAt: null, category: { isActive: true, archivedAt: null } },
      include: productInclude,
    });
    if (!row) return { related: [], source: "database" };
    const relatedRows = await db.product.findMany({
      where: { id: { not: row.id }, categoryId: row.categoryId, status: "ACTIVE", isAvailable: true, archivedAt: null },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: productInclude,
    });
    const product = mapProduct(row, categoryResult.categories);
    return {
      product,
      category: categoryResult.categories.find((category) => category.slug === product.categorySlug),
      related: relatedRows.map((item) => mapProduct(item, categoryResult.categories)),
      source: "database",
    };
  } catch (error) {
    console.error("Storefront product detail query failed", error);
    return { related: [], source: "unavailable", unavailableReason: "query-failed" };
  }
});

export async function getStorefrontProductsByIds(ids: string[]): Promise<StorefrontCatalog> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, 48);
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") return { products: uniqueIds.flatMap((id) => { const product = demoProducts.find((item) => item.id === id); return product ? [product] : []; }), categories: [], source: "demo" };
    return { products: [], categories: [], source: "unavailable", unavailableReason: "not-configured" };
  }
  try {
    const categoryResult = await getStorefrontCategories();
    if (categoryResult.source === "unavailable") return { products: [], categories: [], source: "unavailable", unavailableReason: categoryResult.unavailableReason };
    const rows = await db.product.findMany({
      where: { id: { in: uniqueIds }, status: "ACTIVE", isAvailable: true, archivedAt: null, category: { isActive: true, archivedAt: null } },
      include: productInclude,
    });
    const byId = new Map(rows.map((product) => [product.id, mapProduct(product, categoryResult.categories)]));
    return { products: uniqueIds.flatMap((id) => { const product = byId.get(id); return product ? [product] : []; }), categories: [], source: "database" };
  } catch (error) {
    console.error("Storefront product snapshot query failed", error);
    return { products: [], categories: [], source: "unavailable", unavailableReason: "query-failed" };
  }
}

export async function getStorefrontCategory(slug: string) {
  const catalog = await getStorefrontCategories();
  return { category: catalog.categories.find((item) => item.slug === slug), catalog };
}
