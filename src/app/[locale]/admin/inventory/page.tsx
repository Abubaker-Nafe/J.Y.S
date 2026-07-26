import Link from "next/link";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listInventory, listInventoryAdjustments } from "@/lib/admin/repository";

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ search?: string; state?: string }> }) {
  const locale = getAdminLocale((await params).locale); const query = await searchParams; const [allRows, history] = await Promise.all([listInventory(query.search), listInventoryAdjustments()]); const rows = query.state === "LOW" ? allRows.filter((row) => row.stock > 0 && row.stock <= row.lowStockThreshold) : query.state === "OUT" ? allRows.filter((row) => row.stock <= 0) : allRows;
  return <><PageHeader title={locale === "ar" ? "المخزون" : "Inventory"} description={locale === "ar" ? "راقب مخزون المنتجات والخيارات وسجل التصحيحات اليدوية مع سبب واضح." : "Monitor product and variant stock, with an audit reason for every manual correction."} />
    <form className={styles.toolbar} method="get" role="search"><div className={`${styles.field} ${styles.fieldGrow}`}><label htmlFor="inventory-search">{locale === "ar" ? "بحث" : "Search"}</label><input id="inventory-search" name="search" className={styles.input} defaultValue={query.search} placeholder={locale === "ar" ? "المنتج أو SKU" : "Product or SKU"} /></div><div className={styles.field}><label htmlFor="inventory-state">{locale === "ar" ? "حالة المخزون" : "Stock state"}</label><select id="inventory-state" name="state" className={styles.select} defaultValue={query.state ?? "ALL"}><option value="ALL">{locale === "ar" ? "الكل" : "All"}</option><option value="LOW">{locale === "ar" ? "منخفض" : "Low stock"}</option><option value="OUT">{locale === "ar" ? "نفد" : "Out of stock"}</option></select></div><button className={styles.button} type="submit">{locale === "ar" ? "تصفية" : "Filter"}</button><Link className={styles.buttonSecondary} href={`/${locale}/admin/inventory`}>{locale === "ar" ? "مسح" : "Clear"}</Link></form>
    <InventoryManager locale={locale} rows={rows} history={history} />
  </>;
}
