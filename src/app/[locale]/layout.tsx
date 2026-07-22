import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, localeDirection, locales } from "@/lib/i18n/config";
import { StoreProvider } from "@/components/storefront/store-provider";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { translate } from "@/lib/i18n/dictionaries";
import { getStorefrontCategories } from "@/lib/catalog/server";
import { getPublicBusinessSettings } from "@/lib/i18n/content";

// Prices, stock, sessions, policy content, and business settings are request-time data.
export const dynamic = "force-dynamic";

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params; if (!isLocale(raw)) return {};
  return { title: { default: raw === "ar" ? "JYS | مستلزمات الحلاقة الاحترافية" : "JYS | Professional barber supplies", template: raw === "ar" ? "%s | JYS" : "%s | JYS" }, description: raw === "ar" ? "أدوات حلاقة ومنتجات عناية رجالية احترافية في فلسطين." : "Professional barber tools and men’s grooming supplies across Palestine." };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params; if (!isLocale(raw)) notFound(); const locale = raw;
  const [catalog, business] = await Promise.all([getStorefrontCategories(), getPublicBusinessSettings(locale)]);
  return <div lang={locale} dir={localeDirection(locale)} className="min-h-screen"><a href="#main-content" className="fixed start-4 top-3 z-[100] -translate-y-24 rounded-full bg-accent px-5 py-3 font-bold text-white transition focus:translate-y-0">{translate(locale, "a11y.skip")}</a><StoreProvider locale={locale} initialCurrency={business?.currency ?? "ILS"}><Suspense fallback={null}><SiteHeader locale={locale} categories={catalog.categories} /></Suspense><main id="main-content" tabIndex={-1}>{children}</main><SiteFooter locale={locale} business={business} /></StoreProvider></div>;
}
