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
  return { title: locale === "ar" ? "المنتجات" : "Products" };
}

type Query = { page?: string; q?: string; category?: string; available?: string; sort?: string };

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const [{ locale: raw }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(raw)) notFound();
  const state = parseCatalogUrlState(rawQuery);
  const catalog = await getStorefrontProductsPage({ ...state, pageSize: STOREFRONT_PAGE_SIZE });
  return <div className="container-shell py-12 md:py-16">
    <PageHeading eyebrow={translate(raw, "catalog.eyebrow")} title={translate(raw, "catalog.title")} description={translate(raw, "catalog.subtitle")} />
    <div className="mt-10"><CatalogBrowser locale={raw} catalogProducts={catalog.products} catalogCategories={catalog.categories} pagination={catalog.pagination} unavailable={catalog.source === "unavailable"} initialQuery={state.q} initialCategory={state.category} initialAvailable={state.available} initialSort={state.sort} /></div>
  </div>;
}
