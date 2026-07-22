"use client";

import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { formatMoney } from "@/lib/i18n/format";
import { translate } from "@/lib/i18n/dictionaries";
import { ProductVisual } from "./product-visual";
import { useStore } from "./store-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ProductCard({ product, locale, priority = false, headingLevel = 2 }: { product: Product; locale: Locale; priority?: boolean; headingLevel?: 2 | 3 }) {
  const { addToCart, toggleWishlist, isWishlisted, cartCurrency } = useStore(); const saved = isWishlisted(product.id); const available = product.stock > 0; const productName = localize(product.name, locale); const Heading = headingLevel === 3 ? "h3" : "h2";
  return <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface-strong shadow-sm transition duration-300 hover:-translate-y-1 hover:border-ink/20 hover:shadow-lift">
    <Link href={`/${locale}/product/${product.slug}`} tabIndex={-1} aria-hidden="true" className="relative block overflow-hidden"><ProductVisual product={product} locale={locale} priority={priority} className="aspect-[4/4.25] w-full transition duration-500 group-hover:scale-[1.035]" /><span className="absolute start-3 top-3">{product.featured ? <Badge>{locale === "ar" ? "مميز" : "Featured"}</Badge> : null}</span></Link>
    <button type="button" onClick={() => toggleWishlist(product.id)} aria-label={`${saved ? translate(locale, "common.remove") : translate(locale, "common.save")}: ${productName}`} aria-pressed={saved} className={cn("absolute end-3 top-3 grid size-10 place-items-center rounded-full border border-white/50 shadow-sm backdrop-blur transition", saved ? "bg-accent text-white" : "bg-white/85 text-ink hover:bg-white")}><Heart className={cn("size-4.5", saved && "fill-current")} aria-hidden="true" /></button>
    <div className="flex flex-1 flex-col p-4 sm:p-5"><p className="mb-1 text-[11px] font-black uppercase tracking-[.16em] text-muted">{product.sku}</p><Heading className="line-clamp-2 min-h-[3rem] text-base font-bold leading-6 text-ink"><Link href={`/${locale}/product/${product.slug}`} className="hover:text-accent">{productName}</Link></Heading><div className="mt-auto flex items-end justify-between gap-3 pt-4"><div><strong className="block text-lg font-black text-ink">{formatMoney(product.price, locale, cartCurrency)}</strong><span className={cn("text-xs font-semibold", available ? product.stock < 5 ? "text-amber-700" : "text-success" : "text-red-700")}>{available ? product.stock < 5 ? translate(locale, "common.lowStock", { count: product.stock }) : translate(locale, "common.inStock") : translate(locale, "common.outStock")}</span></div><button type="button" disabled={!available} onClick={() => addToCart(product, 1, product.variants.find((variant) => variant.available && variant.stock > 0)?.id)} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-strong text-white transition hover:bg-accent disabled:bg-line disabled:text-muted" aria-label={`${translate(locale, "common.addCart")}: ${productName}`}><Plus className="size-5" aria-hidden="true" /></button></div></div>
  </article>;
}
