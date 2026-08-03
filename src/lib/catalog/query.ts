export const STOREFRONT_PAGE_SIZE = 8;
export type StorefrontSort = "featured" | "newest" | "low" | "high" | "discount" | "sale-newest";

export interface CatalogUrlState {
  page: number;
  q: string;
  category: string;
  available: boolean;
  sort: StorefrontSort;
}

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function normalizeCatalogSort(value: string): StorefrontSort {
  if (value === "newest" || value === "low" || value === "high" || value === "discount" || value === "sale-newest") return value;
  if (value === "price-asc") return "low";
  if (value === "price-desc") return "high";
  return "featured";
}

export function parseCatalogUrlState(params: Record<string, QueryValue>, defaultCategory = ""): CatalogUrlState {
  const rawPage = Number.parseInt(first(params.page), 10);
  const rawCategory = first(params.category).trim().slice(0, 100);
  return {
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    q: first(params.q).trim().slice(0, 100),
    category: rawCategory === "all" ? "" : rawCategory || defaultCategory,
    available: first(params.available) === "true",
    sort: normalizeCatalogSort(first(params.sort)),
  };
}
