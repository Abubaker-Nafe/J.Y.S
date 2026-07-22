import { Search } from "lucide-react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { parseCatalogUrlState, STOREFRONT_PAGE_SIZE } from "@/lib/catalog/query";
import { getStorefrontProductsPage } from "@/lib/catalog/server";
import { PageHeading } from "@/components/ui/page-heading";
import { CatalogBrowser } from "@/components/storefront/catalog-browser";

type Query = { page?: string; q?: string; category?: string; available?: string; sort?: string };

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const [{ locale: raw }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(raw)) notFound();
  const state = parseCatalogUrlState(rawQuery);
  const catalog = await getStorefrontProductsPage({ ...state, pageSize: STOREFRONT_PAGE_SIZE });
  return <div className="container-shell py-12 md:py-16">
    <PageHeading eyebrow={raw === "ar" ? "بحث JYS" : "JYS search"} title={state.q ? (raw === "ar" ? `نتائج البحث عن «${state.q}»` : `Results for “${state.q}”`) : translate(raw, "nav.search")} description={raw === "ar" ? "ابحث في أدوات الحلاقة ومنتجات العناية المتوفرة." : "Search our available barber tools and grooming essentials."} actions={<Search className="size-10 text-accent" />} />
    <div className="mt-10"><CatalogBrowser locale={raw} catalogProducts={catalog.products} catalogCategories={catalog.categories} pagination={catalog.pagination} unavailable={catalog.source === "unavailable"} initialQuery={state.q} initialCategory={state.category} initialAvailable={state.available} initialSort={state.sort} /></div>
  </div>;
}
