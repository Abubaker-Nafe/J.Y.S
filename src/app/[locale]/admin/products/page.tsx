import Link from "next/link";
import Image from "next/image";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { AdminPagination, EmptyState, PageHeader, StatusBadge, adminStyles as styles } from "@/components/admin/AdminUi";
import { formatAdminDate, formatMoney } from "@/lib/admin/format";
import { adminMessages, getAdminLocale, localizedText } from "@/lib/admin/i18n";
import { getCurrency, listCategories, listProducts } from "@/lib/admin/repository";

type Query = { page?: string; search?: string; status?: string; category?: string };
export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const locale = getAdminLocale((await params).locale);
  const query = await searchParams;
  const [products, categories, currency] = await Promise.all([listProducts({ page: Number(query.page || 1), search: query.search, status: query.status, categoryId: query.category }), listCategories(), getCurrency()]);
  const t = adminMessages[locale];
  const hrefFor = (page: number) => { const value = new URLSearchParams(); if (query.search) value.set("search", query.search); if (query.status) value.set("status", query.status); if (query.category) value.set("category", query.category); value.set("page", String(page)); return `?${value}`; };
  return (
    <>
      <PageHeader title={t.products} description={locale === "ar" ? "إدارة المعلومات الثنائية والأسعار والصور والتوفر دون حذف السجل التاريخي." : "Manage bilingual information, prices, images, and availability without deleting history."} actions={<Link className={styles.button} href={`/${locale}/admin/products/new`}>{t.newProduct}</Link>} />
      <form className={styles.toolbar} method="get" role="search">
        <div className={`${styles.field} ${styles.fieldGrow}`}><label htmlFor="product-search">{t.search}</label><input id="product-search" className={styles.input} name="search" defaultValue={query.search} placeholder={locale === "ar" ? "الاسم أو SKU أو الرابط" : "Name, SKU, or slug"} /></div>
        <div className={styles.field}><label htmlFor="product-status">{t.status}</label><select id="product-status" className={styles.select} name="status" defaultValue={query.status ?? "ALL"}><option value="ALL">{locale === "ar" ? "كل الحالات" : "All statuses"}</option><option value="ACTIVE">{t.active}</option><option value="HIDDEN">{locale === "ar" ? "مخفي" : "Hidden"}</option><option value="DRAFT">{locale === "ar" ? "مسودة" : "Draft"}</option><option value="ARCHIVED">{locale === "ar" ? "مؤرشف" : "Archived"}</option></select></div>
        <div className={styles.field}><label htmlFor="product-category">{t.categories}</label><select id="product-category" className={styles.select} name="category" defaultValue={query.category ?? ""}><option value="">{locale === "ar" ? "كل التصنيفات" : "All categories"}</option>{categories.map((category) => <option key={category.id} value={category.id}>{localizedText(locale, category.nameAr, category.nameEn)}</option>)}</select></div>
        <button className={styles.button} type="submit">{t.filter}</button><Link className={styles.buttonSecondary} href={`/${locale}/admin/products`}>{t.clear}</Link>
      </form>
      <div className={styles.tableWrap}>
        {products.items.length ? <table className={styles.table}><thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>SKU</th><th>{t.categories}</th><th>{locale === "ar" ? "السعر" : "Price"}</th><th>{t.inventory}</th><th>{t.status}</th><th>{locale === "ar" ? "آخر تحديث" : "Updated"}</th><th>{t.actions}</th></tr></thead><tbody>{products.items.map((product) => <tr key={product.id}><td className={styles.primaryCell}><div className={styles.row}>{product.primaryImageUrl ? <Image className={styles.thumb} src={product.primaryImageUrl} alt="" width={45} height={45} unoptimized /> : <span className={`${styles.thumb} ${styles.placeholderThumb}`}>JYS</span>}<span>{localizedText(locale, product.nameAr, product.nameEn)}{product.featured ? <span className={styles.secondaryText}>{t.featured}</span> : null}</span></div></td><td className={styles.numeric}>{product.sku}</td><td>{localizedText(locale, product.categoryNameAr, product.categoryNameEn)}</td><td className={styles.numeric}>{formatMoney(product.price, locale, currency)}</td><td><StatusBadge label={String(product.stock)} tone={product.stock <= 0 ? "danger" : product.stock <= product.lowStockThreshold ? "warning" : "success"} /></td><td><StatusBadge label={product.archivedAt ? (locale === "ar" ? "مؤرشف" : "Archived") : product.active ? t.active : (locale === "ar" ? "مخفي" : "Hidden")} tone={product.archivedAt ? "danger" : product.active ? "success" : "default"} /></td><td>{formatAdminDate(product.updatedAt, locale)}</td><td><div className={styles.tableActions}>{!product.archivedAt ? <Link className={styles.buttonSecondary} href={`/${locale}/admin/products/${product.id}`}>{t.edit}</Link> : null}<ProductRowActions id={product.id} archived={Boolean(product.archivedAt)} locale={locale} /></div></td></tr>)}</tbody></table> : <EmptyState>{t.empty}</EmptyState>}
      </div>
      <AdminPagination locale={locale} page={products.page} pageCount={products.pageCount} total={products.total} hrefFor={hrefFor} label={locale === "ar" ? "صفحات المنتجات" : "Product pages"} previous={t.previous} next={t.next} pageLabel={t.page} ofLabel={t.of} />
    </>
  );
}
