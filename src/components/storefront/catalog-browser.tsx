"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Category, Product } from "@/lib/catalog";
import type { StorefrontSort } from "@/lib/catalog/query";
import type { Locale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { translate } from "@/lib/i18n/dictionaries";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductGrid } from "./product-grid";

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

interface CatalogBrowserProps {
  locale: Locale;
  catalogProducts: Product[];
  catalogCategories: Category[];
  pagination: Pagination;
  unavailable?: boolean;
  initialQuery?: string;
  initialCategory?: string;
  initialAvailable?: boolean;
  initialSort?: StorefrontSort;
  defaultCategory?: string;
  defaultSort?: StorefrontSort;
}

export function CatalogBrowser({
  locale,
  catalogProducts,
  catalogCategories,
  pagination,
  unavailable = false,
  initialQuery = "",
  initialCategory = "",
  initialAvailable = false,
  initialSort = "featured",
  defaultCategory = "",
  defaultSort = "featured",
}: CatalogBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [queryDraft, setQueryDraft] = useState({ baseline: initialQuery, value: initialQuery });
  const query = queryDraft.baseline === initialQuery ? queryDraft.value : initialQuery;
  const serverFilterKey = `${initialCategory}:${initialAvailable}:${initialSort}`;
  const [filterDraft, setFilterDraft] = useState({ baseline: serverFilterKey, category: initialCategory, available: initialAvailable, sort: initialSort });
  const filters = filterDraft.baseline === serverFilterKey ? filterDraft : { baseline: serverFilterKey, category: initialCategory, available: initialAvailable, sort: initialSort };
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
  const hasFilters = Boolean(query || filters.category !== defaultCategory || filters.available || filters.sort !== defaultSort);

  function hrefFor(next: { q?: string; category?: string; available?: boolean; sort?: StorefrontSort; page?: number }) {
    const q = next.q ?? initialQuery;
    const category = next.category ?? filters.category;
    const available = next.available ?? filters.available;
    const sort = next.sort ?? filters.sort;
    const page = next.page ?? pagination.page;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (defaultCategory && !category) params.set("category", "all");
    else if (category && category !== defaultCategory) params.set("category", category);
    if (available) params.set("available", "true");
    if (sort !== defaultSort) params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const suffix = params.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  }

  function navigate(next: { q?: string; category?: string; available?: boolean; sort?: StorefrontSort; page?: number }) {
    startTransition(() => router.replace(hrefFor(next), { scroll: false }));
  }

  useEffect(() => {
    if (query === initialQuery) return;
    const timer = window.setTimeout(() => navigate({ q: query, page: 1 }), 250);
    return () => window.clearTimeout(timer);
    // `navigate` intentionally reflects the latest server-owned filter props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialQuery]);

  function clearFilters() {
    setQueryDraft({ baseline: initialQuery, value: "" });
    setFilterDraft({ baseline: serverFilterKey, category: defaultCategory, available: false, sort: defaultSort });
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  function renderFilters(scope: "desktop" | "mobile") {
    const queryId = `${scope}-catalog-query`;
    const categoryId = `${scope}-category-filter`;
    const sortId = `${scope}-sort-filter`;
    return <>
      <div><Label htmlFor={queryId}>{t("catalog.search")}</Label><div className="relative"><Input id={queryId} type="search" value={query} disabled={isPending} onChange={(event) => setQueryDraft({ baseline: initialQuery, value: event.target.value })} className="ps-10" /><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" /></div></div>
      <div><Label htmlFor={categoryId}>{t("catalog.category")}</Label><Select id={categoryId} value={filters.category} disabled={isPending} onChange={(event) => { const category = event.target.value; setFilterDraft({ ...filters, baseline: serverFilterKey, category }); navigate({ category, page: 1 }); }}><option value="">{t("catalog.allCategories")}</option>{catalogCategories.map((item) => <option key={item.id} value={item.slug}>{localize(item.name, locale)}</option>)}</Select></div>
      <div><Label htmlFor={sortId}>{t("catalog.sort")}</Label><Select id={sortId} value={filters.sort} disabled={isPending} onChange={(event) => { const sort = event.target.value as StorefrontSort; setFilterDraft({ ...filters, baseline: serverFilterKey, sort }); navigate({ sort, page: 1 }); }}><option value="featured">{t("catalog.featured")}</option><option value="newest">{t("catalog.newest")}</option><option value="discount">{t("catalog.biggestDiscount")}</option><option value="sale-newest">{t("catalog.saleNewest")}</option><option value="low">{t("catalog.priceLow")}</option><option value="high">{t("catalog.priceHigh")}</option></Select></div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface-strong px-4 text-sm font-semibold has-disabled:cursor-wait has-disabled:opacity-60"><input type="checkbox" checked={filters.available} disabled={isPending} onChange={(event) => { const available = event.target.checked; setFilterDraft({ ...filters, baseline: serverFilterKey, available }); navigate({ available, page: 1 }); }} className="size-4 accent-accent" />{t("catalog.available")}</label>
      {hasFilters ? <Button variant="quiet" className="w-full" disabled={isPending} onClick={clearFilters}><X className="size-4" />{t("catalog.clear")}</Button> : null}
    </>;
  }

  return <div className="grid gap-8 lg:grid-cols-[16rem_1fr]" aria-busy={isPending}>
    <aside className="hidden lg:block"><div className="sticky top-28 space-y-5 rounded-2xl border border-line bg-surface p-5"><div className="flex items-center gap-2 border-b border-line pb-4 font-black"><SlidersHorizontal className="size-4" />{t("catalog.filters")}</div>{renderFilters("desktop")}</div></aside>
    <section aria-live="polite" className={isPending ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <details className="mb-5 rounded-2xl border border-line bg-surface p-4 lg:hidden"><summary className="flex list-none items-center gap-2 font-black"><SlidersHorizontal className="size-4" />{t("catalog.filters")}</summary><div className="mt-5 space-y-4 border-t border-line pt-5">{renderFilters("mobile")}</div></details>
      <div className="mb-5 flex items-center justify-between gap-4"><p className="text-sm font-bold text-muted">{t("catalog.results", { count: pagination.total })}</p>{hasFilters ? <div className="hidden max-w-[60%] truncate text-xs text-muted sm:block">{query ? `“${query}”` : ""}</div> : null}</div>
      {catalogProducts.length ? <ProductGrid products={catalogProducts} locale={locale} /> : <EmptyState title={unavailable ? (locale === "ar" ? "تعذر تحميل الكتالوج" : "The catalogue is unavailable") : t("catalog.noResults")} text={unavailable ? (locale === "ar" ? "لم نعرض أسعارًا أو مخزونًا احتياطيًا. حاول مرة أخرى بعد قليل." : "We have not shown fallback prices or stock. Please try again shortly.") : t("catalog.noResultsText")} actionLabel={unavailable ? t("common.retry") : t("catalog.clear")} actionHref={pathname} />}
      {pagination.pageCount > 1 ? <nav className="mt-10 flex items-center justify-center gap-3" aria-label={locale === "ar" ? "صفحات المنتجات" : "Product pages"}><Button variant="secondary" disabled={pagination.page <= 1 || isPending} onClick={() => navigate({ page: pagination.page - 1 })}>{t("catalog.previous")}</Button><span className="min-w-20 text-center text-sm font-bold" dir="ltr" aria-live="polite">{pagination.page} / {pagination.pageCount}</span><Button variant="secondary" disabled={pagination.page >= pagination.pageCount || isPending} onClick={() => navigate({ page: pagination.page + 1 })}>{t("catalog.next")}</Button></nav> : null}
    </section>
  </div>;
}
