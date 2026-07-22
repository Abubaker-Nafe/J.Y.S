import type { AdminLocale, AdminReportData } from "@/lib/admin/types";

function safeCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function productReportCsv(report: AdminReportData, locale: AdminLocale) {
  const headers = locale === "ar" ? ["SKU", "المنتج", "الوحدات المباعة", "الإيراد", "المشاهدات", "قوائم الأمنيات", "في السلات", "المخزون"] : ["SKU", "Product", "Units sold", "Revenue", "Views", "Wishlists", "In carts", "Stock"];
  const rows = report.products.map((product) => [product.sku, locale === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr, product.units, product.revenue.toFixed(2), product.views, product.wishlists, product.cartAdds, product.stock]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n")}`;
}
