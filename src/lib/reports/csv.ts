import type { AdminLocale, AdminReportData } from "@/lib/admin/types";

export const reportCsvTypes = ["orders", "sales", "products", "inventory", "customers"] as const;
export type ReportCsvType = (typeof reportCsvTypes)[number];

function safeCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers: Array<string | number>, rows: Array<Array<string | number | null>>) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}`;
}

export function productReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar"
    ? ["SKU", "المنتج", "التصنيف", "الوحدات المباعة", "الإيراد", "المشاهدات", "قوائم الأمنيات", "في السلات", "المخزون"]
    : ["SKU", "Product", "Category", "Units sold", "Revenue", "Views", "Wishlists", "In carts", "Stock"];
  const rows = report.products.map((product) => [
    product.sku,
    locale === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr,
    locale === "ar" ? product.categoryAr || product.categoryEn : product.categoryEn || product.categoryAr,
    product.units,
    product.revenue.toFixed(2),
    product.views,
    product.wishlists,
    product.cartAdds,
    product.stock,
  ]);
  return csv(headers, rows);
}

export function ordersReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar"
    ? ["رقم الطلب", "التاريخ", "العميل", "البريد الإلكتروني", "الهاتف", "طريقة التسليم", "طريقة الدفع", "حالة الدفع", "حالة الطلب", "عدد الأصناف", "الإجمالي الفرعي", "رسوم التوصيل", "الإجمالي", "العملة"]
    : ["Order number", "Date", "Customer", "Email", "Phone", "Fulfillment", "Payment method", "Payment status", "Order status", "Item count", "Subtotal", "Delivery fee", "Total", "Currency"];
  return csv(headers, report.orders.map((order) => [
    order.orderNumber, order.createdAt, order.customerName, order.customerEmail, order.customerPhone,
    order.fulfillmentMethod, order.paymentMethod, order.paymentStatus, order.status, order.itemCount,
    order.subtotal.toFixed(2), order.deliveryFee.toFixed(2), order.total.toFixed(2), order.currency,
  ]));
}

export function salesReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar" ? ["الفترة", "عدد الطلبات", "الإيراد"] : ["Period", "Orders", "Revenue"];
  return csv(headers, report.salesSeries.map((row) => [row.period, row.orders, row.revenue.toFixed(2)]));
}

export function inventoryReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar"
    ? ["SKU", "المنتج", "التصنيف", "المخزون", "حد الانخفاض", "حالة المخزون", "نشط", "متاح"]
    : ["SKU", "Product", "Category", "Stock", "Low-stock threshold", "Stock state", "Active", "Available"];
  return csv(headers, report.products.map((product) => [
    product.sku,
    locale === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr,
    locale === "ar" ? product.categoryAr || product.categoryEn : product.categoryEn || product.categoryAr,
    product.stock,
    product.lowStockThreshold,
    product.stock <= 0 ? "OUT" : product.stock <= product.lowStockThreshold ? "LOW" : "HEALTHY",
    product.active ? "YES" : "NO",
    product.available ? "YES" : "NO",
  ]));
}

export function customersReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar"
    ? ["العميل", "البريد الإلكتروني", "الهاتف", "المدينة", "تاريخ التسجيل", "عدد الطلبات", "إجمالي الإنفاق", "آخر طلب", "نوع العميل"]
    : ["Customer", "Email", "Phone", "City", "Joined", "Orders", "Total spending", "Last order", "Customer type"];
  const inactiveCutoff = Date.now() - 90 * 86_400_000;
  return csv(headers, report.customers.map((customer) => [
    customer.name,
    customer.email,
    customer.phone,
    locale === "ar" ? customer.cityAr || customer.cityEn : customer.cityEn || customer.cityAr,
    customer.joinedAt,
    customer.orderCount,
    customer.spending.toFixed(2),
    customer.lastOrderAt,
    !customer.lastOrderAt || Date.parse(customer.lastOrderAt) < inactiveCutoff ? "INACTIVE" : customer.orderCount > 1 ? "RETURNING" : "NEW",
  ]));
}

export function reportCsv(report: AdminReportData, locale: AdminLocale, type: ReportCsvType) {
  if (type === "orders") return ordersReportCsv(report, locale);
  if (type === "sales") return salesReportCsv(report, locale);
  if (type === "inventory") return inventoryReportCsv(report, locale);
  if (type === "customers") return customersReportCsv(report, locale);
  return productReportCsv(report, locale);
}
