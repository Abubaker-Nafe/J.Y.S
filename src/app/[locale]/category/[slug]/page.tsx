import { notFound } from "next/navigation";
import { parseCatalogUrlState, STOREFRONT_PAGE_SIZE } from "@/lib/catalog/query";
import { getStorefrontProductsPage } from "@/lib/catalog/server";
import { isLocale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { PageHeading } from "@/components/ui/page-heading";
import { CatalogBrowser } from "@/components/storefront/catalog-browser";

type Query = { page?: string; q?: string; category?: string; available?: string; sort?: string };

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Query> }) {
  const [{ locale, slug }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const state = parseCatalogUrlState(rawQuery, slug);
  const catalog = await getStorefrontProductsPage({ ...state, pageSize: STOREFRONT_PAGE_SIZE });
  if (catalog.source === "unavailable") return <div className="container-shell py-12 md:py-16"><PageHeading eyebrow={locale === "ar" ? "كتالوج JYS" : "JYS catalogue"} title={locale === "ar" ? "تعذر تحميل التصنيف" : "Category unavailable"} description={locale === "ar" ? "تعذر التحقق من المنتجات والمخزون من قاعدة البيانات." : "Products and stock could not be verified from the database."} /><div className="mt-10"><CatalogBrowser locale={locale} catalogProducts={[]} catalogCategories={[]} pagination={catalog.pagination} unavailable defaultCategory={slug} initialCategory={state.category} initialQuery={state.q} initialAvailable={state.available} initialSort={state.sort} /></div></div>;
  const category = catalog.categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return <div className="container-shell py-12 md:py-16"><PageHeading eyebrow={locale === "ar" ? "تصنيف JYS" : "JYS category"} title={localize(category.name, locale)} description={localize(category.description, locale)} /><div className="mt-10"><CatalogBrowser locale={locale} catalogProducts={catalog.products} catalogCategories={catalog.categories} pagination={catalog.pagination} defaultCategory={slug} initialCategory={state.category} initialQuery={state.q} initialAvailable={state.available} initialSort={state.sort} /></div></div>;
}
