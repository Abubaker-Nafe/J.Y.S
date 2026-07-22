"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/catalog";
import { translate } from "@/lib/i18n/dictionaries";
import { useStore } from "./store-provider";
import { ProductGrid } from "./product-grid";
import { EmptyState } from "@/components/ui/empty-state";

type LoadState = { key: string; status: "loading" | "ready" | "error"; products: Product[] };

export function WishlistClient({ locale }: { locale: Locale }) {
  const { wishlist } = useStore();
  const key = wishlist.join("|");
  const [loaded, setLoaded] = useState<LoadState>({ key: "", status: "loading", products: [] });
  const current: LoadState = loaded.key === key ? loaded : { key, status: "loading", products: [] };

  useEffect(() => {
    if (!wishlist.length) return;
    const controller = new AbortController();
    const batches = Array.from({ length: Math.ceil(wishlist.length / 48) }, (_, index) => wishlist.slice(index * 48, (index + 1) * 48));
    void Promise.all(batches.map(async (ids) => {
      const response = await fetch(`/api/catalog/products/snapshots?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Product snapshots unavailable");
      return (await response.json()) as { products?: Product[] };
    })).then((payloads) => {
      const products = payloads.flatMap((payload) => payload.products ?? []);
      const byId = new Map(products.map((product) => [product.id, product]));
      setLoaded({ key, status: "ready", products: wishlist.flatMap((id) => { const product = byId.get(id); return product ? [product] : []; }) });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoaded({ key, status: "error", products: [] });
    });
    return () => controller.abort();
  }, [key, wishlist]);

  if (!wishlist.length) return <EmptyState title={translate(locale, "wishlist.empty")} text={translate(locale, "wishlist.emptyText")} actionLabel={translate(locale, "common.shopNow")} actionHref={`/${locale}/products`} />;
  if (current.status === "loading") return <div role="status" className="rounded-2xl border border-line bg-surface p-8 text-center text-sm font-semibold text-muted">{locale === "ar" ? "جارٍ تحميل المنتجات المحفوظة…" : "Loading saved products…"}</div>;
  if (current.status === "error") return <EmptyState title={locale === "ar" ? "تعذر تحميل المنتجات المحفوظة" : "Saved products are unavailable"} text={locale === "ar" ? "تعذر التحقق من المنتجات من قاعدة البيانات. لم نعرض بيانات احتياطية." : "Products could not be verified from the database. No fallback data was shown."} actionLabel={translate(locale, "common.retry")} actionOnClick={() => window.location.reload()} />;
  if (current.products.length) return <ProductGrid products={current.products} locale={locale} />;
  return <EmptyState title={translate(locale, "wishlist.empty")} text={translate(locale, "wishlist.emptyText")} actionLabel={translate(locale, "common.shopNow")} actionHref={`/${locale}/products`} />;
}
