import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { parseCatalogUrlState, STOREFRONT_PAGE_SIZE } from "@/lib/catalog/query";
import { getStorefrontProductsPage } from "@/lib/catalog/server";
import { PageHeading } from "@/components/ui/page-heading";
import { CatalogBrowser } from "@/components/storefront/catalog-browser";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "ar" ? "العروض" : "On sale", description: locale === "ar" ? "العروض الفعّالة لدى JYS" : "Current JYS product offers" };
}

type Query = { page?: string; q?: string; category?: string; available?: string; sort?: string };

export default async function OnSalePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const [{ locale: raw }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(raw)) notFound();
  const state = parseCatalogUrlState({ ...rawQuery, sort: rawQuery.sort || "discount" });
  const catalog = await getStorefrontProductsPage({ ...state, onSale: true, pageSize: STOREFRONT_PAGE_SIZE });
  return <div className="container-shell py-12 md:py-16">
    <PageHeading eyebrow={translate(raw, "sale.eyebrow")} title={translate(raw, "sale.title")} description={translate(raw, "sale.subtitle")} />
    <div className="mt-10"><CatalogBrowser locale={raw} catalogProducts={catalog.products} catalogCategories={catalog.categories} pagination={catalog.pagination} unavailable={catalog.source === "unavailable"} initialQuery={state.q} initialCategory={state.category} initialAvailable={state.available} initialSort={state.sort} defaultSort="discount" /></div>
  </div>;
}
