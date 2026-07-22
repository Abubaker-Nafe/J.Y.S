"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { buttonStyles } from "@/components/ui/button";

export function OrderConfirmationClient({ locale, orderNumber, orderId }: { locale: Locale; orderNumber: string; orderId?: string }) {
  const [state, setState] = useState<"loading" | "verified" | "error">(orderId ? "loading" : "error");
  useEffect(() => {
    if (!orderId) return;
    const controller = new AbortController();
    void fetch(`/api/account/orders/${encodeURIComponent(orderId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); const payload = await response.json() as { order?: { orderNumber?: string } }; setState(payload.order?.orderNumber === orderNumber ? "verified" : "error"); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setState("error"); });
    return () => controller.abort();
  }, [orderId, orderNumber]);
  if (state === "loading") return <div className="py-16 text-center" role="status" aria-live="polite"><LoaderCircle className="mx-auto size-8 animate-spin text-accent" aria-hidden="true" /><p className="mt-4 font-semibold text-muted">{translate(locale, "common.loading")}</p></div>;
  if (state === "error") return <div className="py-12 text-center"><h1 className="font-display text-3xl font-semibold">{locale === "ar" ? "تعذر التحقق من الطلب" : "Order could not be verified"}</h1><p className="mx-auto mt-3 max-w-md text-muted">{locale === "ar" ? "سجّل الدخول وافتح الطلب من سجل طلباتك. لم نعرض تأكيداً غير متحقق منه." : "Sign in and open the order from your order history. We did not display an unverified confirmation."}</p><Link href={`/${locale}/profile/orders`} className={buttonStyles({ className: "mt-6" })}>{translate(locale, "orders.title")}</Link></div>;
  return <div className="py-10 text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-700 text-white shadow-lift"><Check className="size-9" /></span><p className="mt-8 text-xs font-black uppercase tracking-[.25em] text-success">{translate(locale, "checkout.success")}</p><h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">{translate(locale, "checkout.successText")}</h1><div className="mx-auto mt-7 max-w-sm rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-muted">{translate(locale, "checkout.orderNumber")}</p><strong className="mt-1 block font-mono text-2xl tracking-wider" dir="ltr">{orderNumber}</strong></div><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href={`/${locale}/profile/orders/${orderId}`} className={buttonStyles()}>{translate(locale, "common.details")}</Link><Link href={`/${locale}/products`} className={buttonStyles({ variant: "secondary" })}>{translate(locale, "common.continue")}</Link></div></div>;
}
