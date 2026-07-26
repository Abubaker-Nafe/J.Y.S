import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { safeNumber } from "./format";
import { currencyFromSetting } from "@/lib/domain/currency";
import type {
  AdminCategory,
  AdminCity,
  AdminContentPage,
  AdminCustomer,
  AdminDashboardData,
  AdminInventoryAdjustment,
  AdminInventoryRow,
  AdminOrderDetail,
  AdminOrderSummary,
  AdminProductDetail,
  AdminProductSummary,
  Paginated,
} from "./types";

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function normalizedPage(value: number | undefined) {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : 1;
}

function dateFilterValue(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function mapOrderSummary(order: {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  fulfillmentMethod: string;
  currency: string;
  total: unknown;
  createdAt: Date;
}): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentMethod: order.fulfillmentMethod,
    currency: order.currency,
    total: safeNumber(order.total),
    createdAt: order.createdAt.toISOString(),
  };
}

export async function getCurrency() {
  const setting = await db.siteSetting.findUnique({ where: { key: "commerce.currency" }, select: { value: true } });
  return currencyFromSetting(setting?.value);
}

export async function getDashboardData(): Promise<AdminDashboardData> {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const chartStart = new Date(today);
  chartStart.setDate(chartStart.getDate() - 13);
  const fulfilledStatuses = ["DELIVERED", "COLLECTED"] as const;

  const [salesAggregate, todayCount, weekCount, monthCount, newOrders, stockProducts, recentOrders, statusGroups, chartOrders] = await Promise.all([
    db.order.aggregate({ where: { status: { in: [...fulfilledStatuses] } }, _sum: { total: true }, _avg: { total: true } }),
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.order.count({ where: { createdAt: { gte: week } } }),
    db.order.count({ where: { createdAt: { gte: month } } }),
    db.order.count({ where: { status: "NEW" } }),
    db.product.findMany({ where: { archivedAt: null, status: { not: "ARCHIVED" } }, select: { id: true, sku: true, nameAr: true, nameEn: true, stockQuantity: true, lowStockThreshold: true, status: true, isAvailable: true, variants: { where: { isActive: true }, select: { id: true, sku: true, labelAr: true, labelEn: true, stockQuantity: true, isActive: true, isAvailable: true } } } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, orderNumber: true, customerName: true, customerEmail: true, customerPhone: true, status: true, paymentStatus: true, fulfillmentMethod: true, currency: true, total: true, createdAt: true } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.findMany({ where: { createdAt: { gte: chartStart }, status: { in: [...fulfilledStatuses] } }, select: { createdAt: true, total: true } }),
  ]);

  const stockRows = stockProducts.flatMap<AdminInventoryRow>((product) => product.variants.length ? product.variants.map<AdminInventoryRow>((variant) => ({ id: `variant:${variant.id}`, productId: product.id, variantId: variant.id, sku: variant.sku, nameAr: product.nameAr, nameEn: product.nameEn, variantAr: variant.labelAr, variantEn: variant.labelEn, stock: variant.stockQuantity, lowStockThreshold: product.lowStockThreshold, active: product.status === "ACTIVE" && product.isAvailable && variant.isActive && variant.isAvailable })) : [{ id: `product:${product.id}`, productId: product.id, variantId: null, sku: product.sku, nameAr: product.nameAr, nameEn: product.nameEn, variantAr: null, variantEn: null, stock: product.stockQuantity, lowStockThreshold: product.lowStockThreshold, active: product.status === "ACTIVE" && product.isAvailable }]);
  const outOfStock = stockRows.filter((row) => row.stock <= 0);
  const lowStock = stockRows.filter((row) => row.stock > 0 && row.stock <= row.lowStockThreshold);
  const stockAlerts = [...outOfStock, ...lowStock].slice(0, 10);

  const chartMap = new Map<string, { revenue: number; orders: number }>();
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    chartMap.set(date.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const order of chartOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const item = chartMap.get(key);
    if (item) {
      item.revenue += safeNumber(order.total);
      item.orders += 1;
    }
  }

  return {
    metrics: {
      totalSales: safeNumber(salesAggregate._sum.total),
      ordersToday: todayCount,
      ordersWeek: weekCount,
      ordersMonth: monthCount,
      averageOrderValue: safeNumber(salesAggregate._avg.total),
      newOrders,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
    },
    salesSeries: [...chartMap].map(([date, value]) => ({ date: date.slice(5), ...value })),
    statusSummary: statusGroups.map((group) => ({ status: group.status, count: group._count._all })),
    recentOrders: recentOrders.map(mapOrderSummary),
    stockAlerts,
  };
}

export async function listProducts(input: { page?: number; search?: string; status?: string; categoryId?: string; availability?: string; stockState?: string }): Promise<Paginated<AdminProductSummary>> {
  const page = normalizedPage(input.page);
  const pageSize = 20;
  const search = input.search?.trim();
  const status = input.status && ["ALL", "DRAFT", "ACTIVE", "HIDDEN", "ARCHIVED"].includes(input.status) ? input.status : "ALL";
  const availability = input.availability && ["ALL", "AVAILABLE", "UNAVAILABLE"].includes(input.availability) ? input.availability : "ALL";
  const stockState = input.stockState && ["ALL", "LOW", "OUT"].includes(input.stockState) ? input.stockState : "ALL";
  const where: Prisma.ProductWhereInput = {
    ...(status === "ARCHIVED" ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(status !== "ALL" && status !== "ARCHIVED" ? { status: status as Prisma.EnumProductStatusFilter } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(availability === "AVAILABLE" ? { isAvailable: true } : availability === "UNAVAILABLE" ? { isAvailable: false } : {}),
    ...(stockState === "OUT" ? { OR: [{ variants: { some: {}, every: { stockQuantity: { lte: 0 } } } }, { variants: { none: {} }, stockQuantity: { lte: 0 } }] } : {}),
    ...(search ? { OR: [{ sku: { contains: search, mode: "insensitive" } }, { nameAr: { contains: search, mode: "insensitive" } }, { nameEn: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}),
  };
  const postFilterStock = stockState === "LOW";
  const [rows, databaseTotal] = await Promise.all([
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, ...(postFilterStock ? {} : { skip: (page - 1) * pageSize, take: pageSize }), include: { category: { select: { nameAr: true, nameEn: true } }, images: { where: { isPrimary: true }, take: 1, select: { url: true } }, variants: { select: { stockQuantity: true } } } }),
    db.product.count({ where }),
  ]);
  const mapped = rows
    .map((product) => ({ id: product.id, sku: product.sku, slug: product.slug, nameAr: product.nameAr, nameEn: product.nameEn, price: safeNumber(product.price), stock: product.variants.length ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0) : product.stockQuantity, lowStockThreshold: product.lowStockThreshold, status: product.status, available: product.isAvailable, active: product.status === "ACTIVE", featured: product.isFeatured, variationCount: product.variants.length, archivedAt: product.archivedAt?.toISOString() ?? null, categoryNameAr: product.category.nameAr, categoryNameEn: product.category.nameEn, primaryImageUrl: product.images[0]?.url ?? null, updatedAt: product.updatedAt.toISOString() }))
    .filter((product) => !postFilterStock || (product.stock > 0 && product.stock <= product.lowStockThreshold));
  const total = postFilterStock ? mapped.length : databaseTotal;
  return {
    items: postFilterStock ? mapped.slice((page - 1) * pageSize, page * pageSize) : mapped,
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProduct(id: string): Promise<AdminProductDetail | null> {
  const product = await db.product.findUnique({ where: { id }, include: { category: { select: { nameAr: true, nameEn: true } }, images: { orderBy: { displayOrder: "asc" } }, variants: { orderBy: { displayOrder: "asc" } } } });
  if (!product) return null;
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    descriptionAr: product.descriptionAr,
    descriptionEn: product.descriptionEn,
    price: safeNumber(product.price),
    stock: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    status: product.status,
    available: product.isAvailable,
    active: product.status === "ACTIVE",
    featured: product.isFeatured,
    variationCount: product.variants.length,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    categoryId: product.categoryId,
    categoryNameAr: product.category.nameAr,
    categoryNameEn: product.category.nameEn,
    primaryImageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null,
    updatedAt: product.updatedAt.toISOString(),
    images: product.images.map((image) => ({ id: image.id, storageKey: image.storageKey, url: image.url, altAr: image.altAr ?? "", altEn: image.altEn ?? "", position: image.displayOrder, primary: image.isPrimary, mimeType: image.mimeType as AdminProductDetail["images"][number]["mimeType"], sizeBytes: image.sizeBytes })),
    variants: product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, labelAr: variant.labelAr, labelEn: variant.labelEn, priceOverride: variant.priceOverride === null ? null : safeNumber(variant.priceOverride), stock: variant.stockQuantity, available: variant.isAvailable, active: variant.isActive })),
  };
}

export async function listCategories(includeArchived = false): Promise<AdminCategory[]> {
  const categories = await db.category.findMany({ where: includeArchived ? {} : { archivedAt: null }, orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }], include: { _count: { select: { products: true } } } });
  return categories.map((category) => ({ id: category.id, archivedAt: category.archivedAt?.toISOString() ?? null, nameAr: category.nameAr, nameEn: category.nameEn, descriptionAr: category.descriptionAr ?? "", descriptionEn: category.descriptionEn ?? "", slug: category.slug, active: category.isActive && !category.archivedAt, displayOrder: category.displayOrder, productCount: category._count.products }));
}

export async function listInventory(search?: string): Promise<AdminInventoryRow[]> {
  const products = await db.product.findMany({ where: { archivedAt: null, ...(search?.trim() ? { OR: [{ sku: { contains: search.trim(), mode: "insensitive" } }, { nameAr: { contains: search.trim(), mode: "insensitive" } }, { nameEn: { contains: search.trim(), mode: "insensitive" } }, { variants: { some: { sku: { contains: search.trim(), mode: "insensitive" } } } }] } : {}) }, orderBy: { nameEn: "asc" }, include: { variants: { orderBy: { displayOrder: "asc" } } } });
  return products.flatMap<AdminInventoryRow>((product) => {
    if (product.variants.length > 0) return product.variants.map<AdminInventoryRow>((variant) => ({ id: `variant:${variant.id}`, productId: product.id, variantId: variant.id, sku: variant.sku, nameAr: product.nameAr, nameEn: product.nameEn, variantAr: variant.labelAr, variantEn: variant.labelEn, stock: variant.stockQuantity, lowStockThreshold: product.lowStockThreshold, active: product.status === "ACTIVE" && product.isAvailable && variant.isActive && variant.isAvailable }));
    return [{ id: `product:${product.id}`, productId: product.id, variantId: null, sku: product.sku, nameAr: product.nameAr, nameEn: product.nameEn, variantAr: null, variantEn: null, stock: product.stockQuantity, lowStockThreshold: product.lowStockThreshold, active: product.status === "ACTIVE" && product.isAvailable } satisfies AdminInventoryRow];
  });
}

export async function listInventoryAdjustments(limit = 100): Promise<AdminInventoryAdjustment[]> {
  const rows = await db.inventoryAdjustment.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(250, Math.max(1, limit)),
    include: {
      product: { select: { nameAr: true, nameEn: true, sku: true } },
      variant: { select: { labelAr: true, labelEn: true, sku: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    productNameAr: row.product.nameAr,
    productNameEn: row.product.nameEn,
    sku: row.variant?.sku ?? row.product.sku,
    variantAr: row.variant?.labelAr ?? null,
    variantEn: row.variant?.labelEn ?? null,
    previousStock: row.previousStock,
    quantityDelta: row.quantityDelta,
    newStock: row.newStock,
    reason: row.reason,
    admin: row.createdBy?.name || row.createdBy?.email || "System",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listOrders(input: { page?: number; search?: string; status?: string; paymentStatus?: string; fulfillment?: string; from?: string; to?: string }): Promise<Paginated<AdminOrderSummary>> {
  const page = normalizedPage(input.page);
  const pageSize = 20;
  const search = input.search?.trim();
  const from = dateFilterValue(input.from);
  const to = dateFilterValue(input.to, true);
  const status = input.status && ["NEW", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY", "SENT_TO_DELIVERY_COMPANY", "DELIVERED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"].includes(input.status) ? input.status : undefined;
  const paymentStatus = input.paymentStatus && ["PENDING", "PAID", "CANCELLED"].includes(input.paymentStatus) ? input.paymentStatus : undefined;
  const fulfillment = input.fulfillment && ["DELIVERY", "PICKUP"].includes(input.fulfillment) ? input.fulfillment : undefined;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as Prisma.EnumOrderStatusFilter } : {}),
    ...(paymentStatus ? { paymentStatus: paymentStatus as Prisma.EnumPaymentStatusFilter } : {}),
    ...(fulfillment ? { fulfillmentMethod: fulfillment as Prisma.EnumFulfillmentMethodFilter } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(search ? { OR: [{ orderNumber: { contains: search, mode: "insensitive" } }, { customerName: { contains: search, mode: "insensitive" } }, { customerEmail: { contains: search, mode: "insensitive" } }, { customerPhone: { contains: search } }] } : {}),
  };
  const select = { id: true, orderNumber: true, customerName: true, customerEmail: true, customerPhone: true, status: true, paymentStatus: true, fulfillmentMethod: true, currency: true, total: true, createdAt: true } as const;
  const [items, total] = await Promise.all([db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select }), db.order.count({ where })]);
  return { items: items.map(mapOrderSummary), page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getOrder(id: string): Promise<AdminOrderDetail | null> {
  const order = await db.order.findUnique({ where: { id }, include: { items: true, statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true, email: true } } } } } });
  if (!order) return null;
  return {
    ...mapOrderSummary(order),
    subtotal: safeNumber(order.subtotal),
    deliveryFee: safeNumber(order.deliveryFee),
    cityNameAr: order.cityNameAr,
    cityNameEn: order.cityNameEn,
    areaNameAr: order.areaNameAr,
    areaNameEn: order.areaNameEn,
    address: order.addressLine,
    locationDescription: order.locationDetails,
    notes: order.customerNotes,
    policyAcceptedAt: order.policyAcceptedAt.toISOString(),
    items: order.items.map((item) => ({ id: item.id, sku: item.skuSnapshot, productNameAr: item.productNameAr, productNameEn: item.productNameEn, variantLabelAr: item.variantLabelAr, variantLabelEn: item.variantLabelEn, unitPrice: safeNumber(item.unitPrice), quantity: item.quantity, lineTotal: safeNumber(item.lineTotal) })),
    history: order.statusHistory.map((entry) => ({ id: entry.id, fromStatus: entry.fromStatus, toStatus: entry.toStatus, changedBy: entry.changedBy?.name || entry.changedBy?.email || "System", note: entry.note, createdAt: entry.createdAt.toISOString() })),
  };
}

export async function listCustomers(input: { page?: number; search?: string }): Promise<Paginated<AdminCustomer>> {
  const page = normalizedPage(input.page);
  const pageSize = 20;
  const search = input.search?.trim();
  const where: Prisma.UserWhereInput = { role: "CUSTOMER", ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}) };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { addresses: { where: { isActive: true }, select: { city: { select: { nameAr: true, nameEn: true } } } }, orders: { select: { status: true, total: true, createdAt: true }, orderBy: { createdAt: "desc" } } } }),
    db.user.count({ where }),
  ]);
  const items = users.map((user) => {
    const fulfilled = user.orders.filter((order) => order.status === "DELIVERED" || order.status === "COLLECTED");
    return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? "—", city: user.addresses[0]?.city.nameEn ?? user.addresses[0]?.city.nameAr ?? null, orderCount: user.orders.length, totalSpent: fulfilled.reduce((sum, order) => sum + safeNumber(order.total), 0), addressCount: user.addresses.length, joinedAt: user.createdAt.toISOString(), lastOrderAt: user.orders[0]?.createdAt.toISOString() ?? null };
  });
  return { items, page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomer(id: string) {
  const user = await db.user.findFirst({ where: { id, role: "CUSTOMER" }, select: { id: true, name: true, email: true, phone: true, createdAt: true, addresses: { where: { isActive: true }, include: { city: true, area: true }, orderBy: { createdAt: "desc" } }, orders: { orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, customerName: true, customerEmail: true, customerPhone: true, status: true, paymentStatus: true, fulfillmentMethod: true, currency: true, total: true, createdAt: true } } } });
  if (!user) return null;
  const fulfilled = user.orders.filter((order) => order.status === "DELIVERED" || order.status === "COLLECTED");
  return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? "—", joinedAt: user.createdAt.toISOString(), orderCount: user.orders.length, totalSpent: fulfilled.reduce((sum, order) => sum + safeNumber(order.total), 0), addresses: user.addresses.map((address) => ({ id: address.id, label: address.label, recipientName: address.recipientName, phone: address.phone, cityAr: address.city.nameAr, cityEn: address.city.nameEn, areaAr: address.area?.nameAr ?? null, areaEn: address.area?.nameEn ?? null, addressLine: address.addressLine, locationDetails: address.locationDetails })), orders: user.orders.map(mapOrderSummary) };
}

export async function listLocations(): Promise<AdminCity[]> {
  const cities = await db.city.findMany({ orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }], include: { areas: { orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }] } } });
  return cities.map((city) => ({ id: city.id, slug: city.slug, nameAr: city.nameAr, nameEn: city.nameEn, fee: safeNumber(city.deliveryFee), active: city.isActive, displayOrder: city.displayOrder, areas: city.areas.map((area) => ({ id: area.id, slug: area.slug, nameAr: area.nameAr, nameEn: area.nameEn, fee: safeNumber(area.deliveryFee ?? city.deliveryFee), active: area.isActive, displayOrder: area.displayOrder })) }));
}

export async function listContent(): Promise<AdminContentPage[]> {
  const pages = await db.contentPage.findMany({ orderBy: { type: "asc" } });
  return pages.map((page) => ({ id: page.id, key: page.type, slug: page.slug, titleAr: page.titleAr, titleEn: page.titleEn, bodyAr: page.bodyAr, bodyEn: page.bodyEn, active: page.isPublished, updatedAt: page.updatedAt.toISOString() }));
}

export async function listSettings() {
  return db.siteSetting.findMany({ orderBy: { key: "asc" }, select: { key: true, value: true, description: true, isPublic: true } });
}
