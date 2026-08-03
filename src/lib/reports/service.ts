import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { safeNumber } from "@/lib/admin/format";
import type { AdminReportData } from "@/lib/admin/types";
import { resolveSalePricing } from "@/lib/domain/pricing";

type ReportStatus = "FULFILLED" | "ALL" | "NEW" | "CONFIRMED" | "PREPARING" | "READY_FOR_DELIVERY" | "SENT_TO_DELIVERY_COMPANY" | "DELIVERED" | "READY_FOR_PICKUP" | "COLLECTED" | "CANCELLED";
export type ReportFilters = {
  from?: string;
  to?: string;
  status?: ReportStatus;
  categoryId?: string;
  fulfillment?: "ALL" | "DELIVERY" | "PICKUP";
  payment?: "ALL" | "CASH_ON_DELIVERY" | "CASH_ON_PICKUP";
  paymentStatus?: "ALL" | "PENDING" | "PAID" | "CANCELLED";
  group?: "day" | "week" | "month";
};

function validDate(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  // Admin filters and chart keys are date-only values. Interpret both ends in
  // UTC so the queried range and generated buckets cannot shift when the Node
  // process runs in a positive or negative local timezone.
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateKey(value: Date) { return value.toISOString().slice(0, 10); }

function bucketKey(value: Date, group: "day" | "week" | "month") {
  if (group === "month") return value.toISOString().slice(0, 7);
  if (group === "week") {
    const monday = new Date(value); monday.setUTCHours(0, 0, 0, 0);
    const day = monday.getUTCDay(); monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
    return dateKey(monday);
  }
  return dateKey(value);
}

function nextBucket(value: Date, group: "day" | "week" | "month") {
  if (group === "month") value.setUTCMonth(value.getUTCMonth() + 1, 1);
  else value.setUTCDate(value.getUTCDate() + (group === "week" ? 7 : 1));
}

export async function getReportData(filters: ReportFilters = {}): Promise<AdminReportData> {
  const now = new Date();
  const fallbackFrom = new Date(now); fallbackFrom.setUTCDate(fallbackFrom.getUTCDate() - 29); fallbackFrom.setUTCHours(0, 0, 0, 0);
  const fromDate = validDate(filters.from) ?? fallbackFrom;
  const toDate = validDate(filters.to, true) ?? now;
  const allowedStatuses: ReportStatus[] = ["FULFILLED", "ALL", "NEW", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY", "SENT_TO_DELIVERY_COMPANY", "DELIVERED", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"];
  const status = filters.status && allowedStatuses.includes(filters.status) ? filters.status : "FULFILLED";
  const categoryId = filters.categoryId?.trim() ?? "";
  const fulfillment = filters.fulfillment ?? "ALL";
  const payment = filters.payment ?? "ALL";
  const paymentStatus = filters.paymentStatus ?? "ALL";
  const group = filters.group ?? "day";
  const statusWhere: Prisma.OrderWhereInput = status === "ALL" ? {} : status === "FULFILLED" ? { status: { in: ["DELIVERED", "COLLECTED"] } } : { status };
  const range = { gte: fromDate, lte: toDate };
  const dimensionWhere: Prisma.OrderWhereInput = {
    createdAt: range,
    ...(categoryId ? { items: { some: { product: { categoryId } } } } : {}),
    ...(fulfillment === "ALL" ? {} : { fulfillmentMethod: fulfillment }),
    ...(payment === "ALL" ? {} : { paymentMethod: payment }),
    ...(paymentStatus === "ALL" ? {} : { paymentStatus }),
  };
  const orderWhere: Prisma.OrderWhereInput = { ...dimensionWhere, ...statusWhere };
  const productDimensionWhere: Prisma.ProductWhereInput = categoryId ? { categoryId } : {};

  const [reportOrders, allRangeOrders, products, itemGroups, viewGroups, wishlistGroups, cartGroups, totalCustomers, newCustomers, customerRows, abandonedCarts, pairOrders] = await Promise.all([
    db.order.findMany({ where: orderWhere, orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, createdAt: true, customerName: true, customerEmail: true, customerPhone: true, fulfillmentMethod: true, paymentMethod: true, paymentStatus: true, status: true, currency: true, subtotal: true, _count: { select: { items: true } } } }),
    db.order.findMany({ where: dimensionWhere, select: { status: true, fulfillmentMethod: true } }),
    db.product.findMany({ where: { archivedAt: null, ...productDimensionWhere }, select: { id: true, sku: true, nameAr: true, nameEn: true, status: true, isAvailable: true, price: true, isOnSale: true, salePrice: true, saleStartsAt: true, saleEndsAt: true, stockQuantity: true, lowStockThreshold: true, variants: { where: { isActive: true }, select: { stockQuantity: true } }, category: { select: { id: true, nameAr: true, nameEn: true } } } }),
    db.orderItem.groupBy({ by: ["productId"], where: { productId: { not: null }, order: orderWhere }, _sum: { quantity: true, lineTotal: true } }),
    db.productView.groupBy({ by: ["productId"], where: { viewedAt: range, ...(categoryId ? { product: { categoryId } } : {}) }, _count: { _all: true } }),
    db.wishlistItem.groupBy({ by: ["productId"], where: { createdAt: range, ...(categoryId ? { product: { categoryId } } : {}) }, _count: { _all: true } }),
    db.cartItem.groupBy({ by: ["productId"], where: { createdAt: range, cart: { status: "ACTIVE" }, ...(categoryId ? { product: { categoryId } } : {}) }, _sum: { quantity: true } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: range } }),
    db.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, name: true, email: true, phone: true, createdAt: true, addresses: { where: { isActive: true }, take: 1, select: { city: { select: { nameAr: true, nameEn: true } } } }, orders: { where: orderWhere, select: { subtotal: true, createdAt: true }, orderBy: { createdAt: "desc" } } } }),
    db.cart.count({ where: { OR: [{ status: "ABANDONED", updatedAt: range }, { status: "ACTIVE", updatedAt: { lte: new Date(now.getTime() - 7 * 86_400_000) } }] } }),
    db.order.findMany({ where: { ...dimensionWhere, status: { in: ["DELIVERED", "COLLECTED"] } }, select: { items: { select: { productId: true, productNameAr: true, productNameEn: true } } } }),
  ]);

  const itemMap = new Map(itemGroups.flatMap((group) => group.productId ? [[group.productId, { units: group._sum.quantity ?? 0, revenue: safeNumber(group._sum.lineTotal) }] as const] : []));
  const viewMap = new Map(viewGroups.map((group) => [group.productId, group._count._all]));
  const wishlistMap = new Map(wishlistGroups.map((group) => [group.productId, group._count._all]));
  const cartMap = new Map(cartGroups.map((group) => [group.productId, group._sum.quantity ?? 0]));
  const productRows = products.map((product) => {
    const pricing = resolveSalePricing({ normalPrice: product.price, isOnSale: product.isOnSale, salePrice: product.salePrice, saleStartsAt: product.saleStartsAt, saleEndsAt: product.saleEndsAt, productActive: product.status === "ACTIVE" && product.isAvailable });
    return { id: product.id, sku: product.sku, nameAr: product.nameAr, nameEn: product.nameEn, units: itemMap.get(product.id)?.units ?? 0, revenue: itemMap.get(product.id)?.revenue ?? 0, views: viewMap.get(product.id) ?? 0, wishlists: wishlistMap.get(product.id) ?? 0, cartAdds: cartMap.get(product.id) ?? 0, stock: product.variants.length ? product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0) : product.stockQuantity, lowStockThreshold: product.lowStockThreshold, active: product.status === "ACTIVE", available: product.isAvailable, category: product.category, normalPrice: safeNumber(product.price), salePrice: product.salePrice === null ? null : safeNumber(product.salePrice), effectivePrice: Number(pricing.effectivePrice), discountPercentage: pricing.discountPercentage, saleStatus: pricing.status };
  }).sort((a, b) => b.revenue - a.revenue || b.units - a.units);
  const categoryMap = new Map<string, { id: string; nameAr: string; nameEn: string; units: number; revenue: number }>();
  for (const product of productRows) {
    const current = categoryMap.get(product.category.id) ?? { ...product.category, units: 0, revenue: 0 };
    current.units += product.units; current.revenue += product.revenue; categoryMap.set(product.category.id, current);
  }

  const salesMap = new Map<string, { revenue: number; orders: number }>();
  const cursor = new Date(fromDate); cursor.setUTCHours(0, 0, 0, 0);
  if (group === "month") cursor.setUTCDate(1);
  else if (group === "week") { const day = cursor.getUTCDay(); cursor.setUTCDate(cursor.getUTCDate() - (day === 0 ? 6 : day - 1)); }
  const last = new Date(toDate); last.setUTCHours(0, 0, 0, 0);
  const maximumBuckets = group === "day" ? 367 : group === "week" ? 105 : 61;
  while (cursor <= last && salesMap.size < maximumBuckets) { salesMap.set(bucketKey(cursor, group), { revenue: 0, orders: 0 }); nextBucket(cursor, group); }
  for (const order of reportOrders) { const key = bucketKey(order.createdAt, group); const bucket = salesMap.get(key); if (bucket) { bucket.revenue += safeNumber(order.subtotal); bucket.orders += 1; } }
  const revenue = reportOrders.reduce((sum, order) => sum + safeNumber(order.subtotal), 0);

  const customers = customerRows.map((customer) => ({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone ?? "", cityAr: customer.addresses[0]?.city.nameAr ?? null, cityEn: customer.addresses[0]?.city.nameEn ?? null, orderCount: customer.orders.length, spending: customer.orders.reduce((sum, order) => sum + safeNumber(order.subtotal), 0), joinedAt: customer.createdAt.toISOString(), lastOrderAt: customer.orders[0]?.createdAt.toISOString() ?? null })).sort((a, b) => b.spending - a.spending || b.orderCount - a.orderCount);
  const returningCustomers = customerRows.filter((customer) => customer.orders.length > 1).length;

  const pairMap = new Map<string, { count: number; ar: string; en: string }>();
  for (const order of pairOrders) {
    const unique = [...new Map(order.items.filter((item) => item.productId).map((item) => [item.productId as string, item])).values()];
    for (let left = 0; left < unique.length; left += 1) for (let right = left + 1; right < unique.length; right += 1) {
      const a = unique[left]; const b = unique[right]; if (!a || !b || !a.productId || !b.productId) continue;
      const ids = [a.productId, b.productId].sort(); const key = ids.join(":"); const current = pairMap.get(key) ?? { count: 0, ar: `${a.productNameAr} + ${b.productNameAr}`, en: `${a.productNameEn} + ${b.productNameEn}` }; current.count += 1; pairMap.set(key, current);
    }
  }
  const bestPair = [...pairMap.values()].sort((a, b) => b.count - a.count)[0];
  const restock = productRows.filter((product) => product.stock <= products.find((item) => item.id === product.id)!.lowStockThreshold).sort((a, b) => b.units - a.units)[0];
  const notSelling = productRows.filter((product) => product.units === 0).slice(0, 3);
  const topCategory = [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue)[0];
  const popularWishlist = [...productRows].sort((a, b) => b.wishlists - a.wishlists)[0];
  const cartNotOrdered = [...productRows].sort((a, b) => b.cartAdds - a.cartAdds).find((product) => product.cartAdds > 0 && product.units === 0);
  const inactiveCustomers = customerRows.filter((customer) => !customer.orders[0] || customer.orders[0].createdAt < new Date(now.getTime() - 90 * 86_400_000)).length;
  const salesSeries = [...salesMap].map(([period, bucket]) => ({ period: group === "month" ? period : period.slice(5), ...bucket }));
  const insights: AdminReportData["insights"] = [];
  if (restock) insights.push({ key: "restock", titleAr: "أولوية إعادة التخزين", titleEn: "Restock priority", detailAr: `${restock.nameAr}: متاح ${restock.stock}، ومبيع ${restock.units}.`, detailEn: `${restock.nameEn}: ${restock.stock} available and ${restock.units} sold.` });
  if (notSelling.length) insights.push({ key: "not-selling", titleAr: "منتجات دون مبيعات", titleEn: "Products without sales", detailAr: notSelling.map((item) => item.nameAr).join("، "), detailEn: notSelling.map((item) => item.nameEn).join(", ") });
  if (topCategory && topCategory.revenue > 0) insights.push({ key: "top-category", titleAr: "التصنيف الأعلى إيرادًا", titleEn: "Highest-revenue category", detailAr: `${topCategory.nameAr}: ${topCategory.revenue.toFixed(2)}`, detailEn: `${topCategory.nameEn}: ${topCategory.revenue.toFixed(2)}` });
  if (bestPair && bestPair.count >= 2) insights.push({ key: "pair", titleAr: "يُشترى معًا", titleEn: "Frequently purchased together", detailAr: `${bestPair.ar} (${bestPair.count})`, detailEn: `${bestPair.en} (${bestPair.count})` });
  if (popularWishlist && popularWishlist.wishlists > 0) insights.push({ key: "wishlist", titleAr: "الأكثر حفظًا", titleEn: "Most wishlisted", detailAr: `${popularWishlist.nameAr}: ${popularWishlist.wishlists}`, detailEn: `${popularWishlist.nameEn}: ${popularWishlist.wishlists}` });
  if (cartNotOrdered) insights.push({ key: "cart-not-ordered", titleAr: "في السلات دون طلب", titleEn: "In carts but not ordered", detailAr: `${cartNotOrdered.nameAr}: ${cartNotOrdered.cartAdds}`, detailEn: `${cartNotOrdered.nameEn}: ${cartNotOrdered.cartAdds}` });
  if (inactiveCustomers > 0) insights.push({ key: "inactive-customers", titleAr: "عملاء غير نشطين", titleEn: "Inactive customers", detailAr: `${inactiveCustomers} عميل لم يطلب خلال 90 يومًا.`, detailEn: `${inactiveCustomers} customers have not ordered in 90 days.` });
  if (salesSeries.length >= 2) {
    const midpoint = Math.floor(salesSeries.length / 2);
    const previousRevenue = salesSeries.slice(0, midpoint).reduce((sum, item) => sum + item.revenue, 0);
    const currentRevenue = salesSeries.slice(midpoint).reduce((sum, item) => sum + item.revenue, 0);
    if (previousRevenue > 0) {
      const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      insights.push({ key: "sales-trend", titleAr: "تغير اتجاه المبيعات", titleEn: "Sales trend change", detailAr: `${change >= 0 ? "+" : ""}${change.toFixed(1)}% مقارنة بنصف الفترة السابق.`, detailEn: `${change >= 0 ? "+" : ""}${change.toFixed(1)}% versus the previous half of the period.` });
    }
  }
  if (abandonedCarts > 0) insights.push({ key: "carts", titleAr: "سلات غير مكتملة", titleEn: "Unconverted carts", detailAr: `${abandonedCarts} سلات تحتاج إلى متابعة الاتجاه العام.`, detailEn: `${abandonedCarts} carts are unconverted; monitor the trend.` });

  return {
    from: dateKey(fromDate), to: dateKey(toDate), status, categoryId, fulfillment, payment, paymentStatus, group,
    metrics: { revenue, orderCount: reportOrders.length, averageOrderValue: reportOrders.length ? revenue / reportOrders.length : 0, fulfilledOrders: allRangeOrders.filter((order) => order.status === "DELIVERED" || order.status === "COLLECTED").length, deliveredOrders: allRangeOrders.filter((order) => order.status === "DELIVERED").length, collectedOrders: allRangeOrders.filter((order) => order.status === "COLLECTED").length, cancelledOrders: allRangeOrders.filter((order) => order.status === "CANCELLED").length, deliveryOrders: allRangeOrders.filter((order) => order.fulfillmentMethod === "DELIVERY").length, pickupOrders: allRangeOrders.filter((order) => order.fulfillmentMethod === "PICKUP").length, registeredCustomers: totalCustomers, newCustomers, returningCustomers, abandonedCarts },
    salesSeries,
    orders: reportOrders.map((order) => ({ orderNumber: order.orderNumber, createdAt: order.createdAt.toISOString(), customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, fulfillmentMethod: order.fulfillmentMethod, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, status: order.status, currency: order.currency, subtotal: safeNumber(order.subtotal), total: safeNumber(order.subtotal), itemCount: order._count.items })),
    products: productRows.map((product) => ({ id: product.id, sku: product.sku, nameAr: product.nameAr, nameEn: product.nameEn, units: product.units, revenue: product.revenue, views: product.views, wishlists: product.wishlists, cartAdds: product.cartAdds, stock: product.stock, lowStockThreshold: product.lowStockThreshold, categoryAr: product.category.nameAr, categoryEn: product.category.nameEn, active: product.active, available: product.available, normalPrice: product.normalPrice, salePrice: product.salePrice, effectivePrice: product.effectivePrice, discountPercentage: product.discountPercentage, saleStatus: product.saleStatus })),
    categories: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue),
    customers: customers.slice(0, 50),
    insights,
  };
}
