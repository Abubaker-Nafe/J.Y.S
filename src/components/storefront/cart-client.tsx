"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, ShoppingBag, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { formatMoney } from "@/lib/i18n/format";
import { translate } from "@/lib/i18n/dictionaries";
import { useStore } from "./store-provider";
import { ProductVisual } from "./product-visual";
import { QuantityControl } from "./quantity-control";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CartClient({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { lines, subtotal, cartCurrency, cartIssues, user, updateQuantity, removeFromCart, refreshCart, syncCart } = useStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [validationError, setValidationError] = useState("");
  const t = (key: string) => translate(locale, key);
  const priceChanged = cartIssues.some((issue) => issue.code === "PRICE_CHANGED");
  const availabilityChanged = cartIssues.some((issue) => issue.code === "UNAVAILABLE_OR_LOW_STOCK");
  const invalidStock = availabilityChanged || lines.some((line) => line.availableStock < 1 || line.quantity > line.availableStock);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  async function continueToCheckout() {
    setCheckingOut(true);
    setValidationError("");
    const verified = user ? await syncCart() : await refreshCart(true);
    if (verified) router.push(`/${locale}/checkout`);
    else setValidationError(locale === "ar" ? "تعذر التحقق من السلة أو تغيّر المخزون. راجع المنتجات وحاول مجددًا." : "The cart could not be verified or stock changed. Review the items and try again.");
    setCheckingOut(false);
  }

  if (!lines.length) return <EmptyState title={t("cart.empty")} text={t("cart.emptyText")} actionLabel={t("common.shopNow")} actionHref={`/${locale}/products`} />;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_23rem] lg:items-start">
      <div className="space-y-4">
        {cartIssues.length ? (
          <div id="cart-server-warning" role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                {priceChanged ? <p>{locale === "ar" ? "تغيّر سعر منتج واحد أو أكثر. راجع الأسعار الحالية قبل المتابعة." : "One or more product prices changed. Review the current prices before continuing."}</p> : null}
                {availabilityChanged ? <p>{locale === "ar" ? "تغيّر توفر المخزون لبعض المنتجات. عدّل الكمية أو أزل المنتج غير المتاح." : "Stock availability changed for some items. Adjust the quantity or remove unavailable items."}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
        {lines.map((line) => {
          const variant = line.product.variants.find((item) => item.id === line.variantId);
          const unavailable = line.availableStock < 1;
          const excessive = line.quantity > line.availableStock;
          return (
            <article key={line.key} className={cn("grid grid-cols-[6rem_1fr] gap-4 rounded-2xl border bg-surface-strong p-3 sm:grid-cols-[8rem_1fr] sm:p-4", unavailable || excessive ? "border-amber-400" : "border-line")}>
              <Link href={`/${locale}/product/${line.product.slug}`} className="overflow-hidden rounded-xl"><ProductVisual product={line.product} className="aspect-square w-full" /></Link>
              <div className="flex min-w-0 flex-col sm:flex-row sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-bold"><Link href={`/${locale}/product/${line.product.slug}`} className="hover:text-accent">{localize(line.product.name, locale)}</Link></h2>
                  {variant ? <p className="mt-1 text-sm text-muted">{localize(variant.label, locale)}</p> : null}
                  <p className="mt-2 font-black">{formatMoney(line.unitPrice, locale, cartCurrency)}</p>
                  {unavailable ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-700"><AlertTriangle className="size-3.5" />{locale === "ar" ? "غير متاح حاليًا — أزل المنتج للمتابعة." : "Currently unavailable — remove this item to continue."}</p>
                  ) : excessive ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-700"><AlertTriangle className="size-3.5" />{locale === "ar" ? `المتوفر الآن ${line.availableStock} فقط.` : `Only ${line.availableStock} now available.`}</p>
                  ) : line.quantity >= line.availableStock ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-700"><AlertTriangle className="size-3.5" />{translate(locale, "common.lowStock", { count: line.availableStock })}</p>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 sm:mt-0 sm:flex-col sm:items-end">
                  <QuantityControl
                    value={line.quantity}
                    max={Math.max(1, line.availableStock)}
                    onChange={(value) => { void refreshCart(true).then((fresh) => { if (fresh) updateQuantity(line.key, value); }); }}
                    label={localize(line.product.name, locale)}
                    locale={locale}
                  />
                  <button type="button" onClick={() => removeFromCart(line.key)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="size-4" />{t("common.remove")}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <aside className="sticky top-28 rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-2xl font-semibold">{t("cart.summary")}</h2>
        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted">{t("cart.subtotal")}</dt><dd className="font-bold">{formatMoney(subtotal, locale, cartCurrency)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">{t("cart.delivery")}</dt><dd className="font-semibold text-muted">{t("cart.deliveryLater")}</dd></div>
          <div className="flex justify-between gap-4 border-t border-line pt-4 text-lg"><dt className="font-black">{t("cart.total")}</dt><dd className="font-black">{formatMoney(subtotal, locale, cartCurrency)}</dd></div>
        </dl>
        {invalidStock ? (
          <span aria-disabled="true" aria-describedby="cart-server-warning" className={buttonStyles({ size: "lg", className: "mt-6 w-full cursor-not-allowed opacity-50" })}>{t("cart.checkout")}<ArrowUpRight className="size-4 rtl:-scale-x-100" /></span>
        ) : (
          <button type="button" disabled={checkingOut} onClick={() => void continueToCheckout()} aria-describedby={cartIssues.length ? "cart-server-warning" : undefined} className={buttonStyles({ size: "lg", className: "mt-6 w-full" })}>{checkingOut ? (locale === "ar" ? "جارٍ التحقق…" : "Checking stock…") : t("cart.checkout")}<ArrowUpRight className="size-4 rtl:-scale-x-100" /></button>
        )}
        {validationError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{validationError}</p> : null}
        <p className="mt-4 flex gap-2 text-xs leading-5 text-muted"><ShoppingBag className="mt-0.5 size-4 shrink-0" />{t("cart.notReserved")}</p>
      </aside>
    </div>
  );
}
