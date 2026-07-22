"use client";

import { useMemo, useState } from "react";
import { Banknote, Check, Heart, PackageCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { formatMoney } from "@/lib/i18n/format";
import { translate } from "@/lib/i18n/dictionaries";
import { ProductVisual } from "./product-visual";
import { QuantityControl } from "./quantity-control";
import { useStore } from "./store-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ProductDetailClient({ product, locale }: { product: Product; locale: Locale }) {
  const firstVariant = product.variants.find((variant) => variant.available && variant.stock > 0); const [variantId, setVariantId] = useState(firstVariant?.id ?? ""); const [quantity, setQuantity] = useState(1); const [view, setView] = useState(0); const { addToCart, toggleWishlist, isWishlisted, cartCurrency } = useStore();
  const gallery: Array<string | undefined> = product.images?.length ? product.images : [product.visual.image];
  const variant = product.variants.find((item) => item.id === variantId); const stock = variant?.stock ?? product.stock; const available = stock > 0 && (!variant || variant.available); const price = variant?.price ?? product.price; const saved = isWishlisted(product.id); const t = (key: string, values?: Record<string,string|number>) => translate(locale,key,values);
  const safeQuantity = Math.min(Math.max(quantity, 1), Math.max(stock, 1));
  const benefits = useMemo(() => [[Banknote,"product.cashNote"],[PackageCheck,"product.shippingNote"],[ShieldCheck,"product.policyNote"]] as const, []);
  return <div className="grid gap-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
    <section aria-label={locale === "ar" ? "صور المنتج" : "Product images"} className="min-w-0"><ProductVisual product={product} locale={locale} imageOverride={gallery[view]} priority className="aspect-square w-full rounded-3xl border border-line shadow-soft transition" />{gallery.length > 1 ? <div className="mt-3 grid grid-cols-4 gap-3">{gallery.map((image, item) => <button key={`${image ?? "illustration"}-${item}`} type="button" onClick={() => setView(item)} aria-label={`${locale === "ar" ? "عرض الصورة" : "View image"} ${item + 1}`} aria-pressed={view === item} className={cn("overflow-hidden rounded-xl border-2 transition", view === item ? "border-accent" : "border-transparent opacity-70 hover:opacity-100")}><ProductVisual product={product} locale={locale} imageOverride={image} className="aspect-[4/3] w-full" /></button>)}</div> : null}</section>
    <section className="lg:pt-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={available ? "success" : "danger"}>{available ? stock < 5 ? t("common.lowStock",{count:stock}) : t("common.inStock") : t("common.outStock")}</Badge>{product.featured ? <Badge>{locale === "ar" ? "اختيار JYS" : "JYS pick"}</Badge> : null}</div><h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] md:text-6xl">{localize(product.name, locale)}</h1><p className="mt-4 text-sm font-bold uppercase tracking-[.12em] text-muted">{t("product.sku")}: {variant?.sku ?? product.sku}</p><p className="mt-7 text-3xl font-black">{formatMoney(price,locale,cartCurrency)}</p><p className="mt-6 text-lg leading-8 text-muted">{localize(product.description,locale)}</p>
      {product.variants.length ? <fieldset className="mt-8"><legend className="mb-3 text-sm font-black">{t("product.chooseVariation")}</legend><div className="flex flex-wrap gap-2">{product.variants.map((item) => { const disabled=!item.available||item.stock<1; return <label key={item.id} className={cn("relative flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent/60",variantId===item.id?"border-accent bg-accent/5":"border-line bg-surface-strong hover:border-ink/30",disabled&&"cursor-not-allowed opacity-45")}><input type="radio" name="variant" className="sr-only" value={item.id} checked={variantId===item.id} disabled={disabled} onChange={() => setVariantId(item.id)} />{variantId===item.id?<Check className="size-4 text-accent"/>:null}<span>{localize(item.label,locale)}</span>{item.price?<span className="text-muted">· {formatMoney(item.price,locale,cartCurrency)}</span>:null}</label>; })}</div></fieldset> : null}
      <div className="mt-8"><p className="mb-3 text-sm font-black">{t("product.quantity")}</p><div className="flex flex-wrap items-center gap-3"><QuantityControl value={safeQuantity} max={Math.max(stock,1)} onChange={setQuantity} label={t("product.quantity")} /><Button size="lg" className="min-w-[13rem] flex-1" disabled={!available || (product.variants.length > 0 && !variantId)} onClick={() => addToCart(product,safeQuantity,variantId||undefined)}><ShoppingBag className="size-5" />{t("common.addCart")}</Button><Button variant="secondary" size="icon" onClick={() => toggleWishlist(product.id)} aria-label={saved?t("common.remove"):t("common.save")} aria-pressed={saved}><Heart className={cn("size-5",saved&&"fill-accent text-accent")} /></Button></div><p className="mt-3 text-xs text-muted">{t("product.stockNote")}</p></div>
      <div className="mt-9 divide-y divide-line rounded-2xl border border-line bg-surface">{benefits.map(([Icon,key])=><div key={key} className="flex items-center gap-4 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-strong text-white"><Icon className="size-4" /></span><p className="text-sm font-semibold">{t(key)}</p></div>)}</div>
    </section>
  </div>;
}
