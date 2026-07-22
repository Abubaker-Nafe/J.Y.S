"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu, Search, Truck } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import type { Category } from "@/lib/catalog";
import { localize } from "@/lib/demo/catalog";
import { BrandMark } from "./brand-mark";
import { HeaderActions } from "./header-actions";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({ locale, categories }: { locale: Locale; categories: Category[] }) {
  const t = (key: string) => translate(locale, key);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const closeMobileMenu = () => mobileMenu.current?.removeAttribute("open");
  return <>
    <div className="bg-brand-strong px-4 py-2 text-center text-xs font-semibold text-white/85"><span className="inline-flex items-center gap-2"><Truck className="size-4 text-[#d59a67]" aria-hidden="true" />{t("home.heroNote")}</span></div>
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/95 backdrop-blur-xl" data-no-print>
      <div className="container-shell flex h-[74px] items-center justify-between gap-3">
        <BrandMark locale={locale} />
        <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"} className="hidden items-center gap-1 lg:flex">
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}`}>{t("nav.home")}</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}/products`}>{t("nav.products")}</Link>
          <details className="group relative">
            <summary className="list-none rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6">{t("nav.categories")}</summary>
            <div className="absolute left-1/2 top-[calc(100%+1rem)] grid w-[36rem] -translate-x-1/2 grid-cols-2 gap-2 rounded-2xl border border-line bg-surface-strong p-3 shadow-lift">
              {categories.map((category: Category) => <Link key={category.id} href={`/${locale}/category/${category.slug}`} className="group/item rounded-xl p-4 transition hover:bg-canvas"><span className="mb-2 block h-1 w-8 rounded-full transition-all group-hover/item:w-14" style={{ backgroundColor: category.accent }} /><strong className="block text-sm text-ink">{localize(category.name, locale)}</strong><small className="mt-1 block text-muted">{localize(category.description, locale)}</small></Link>)}
            </div>
          </details>
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}/delivery`}>{t("nav.delivery")}</Link>
        </nav>
        <div className="flex items-center gap-1">
          <form action={`/${locale}/search`} className="relative hidden xl:block"><label className="sr-only" htmlFor="header-search">{t("nav.search")}</label><input id="header-search" name="q" type="search" className="h-10 w-52 rounded-full border border-line bg-surface ps-10 pe-4 text-sm outline-none transition focus:w-64 focus:border-accent focus:bg-white" placeholder={t("nav.search")} /><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" /></form>
          <div className="hidden sm:block"><LanguageSwitcher locale={locale} /></div><HeaderActions locale={locale} />
          <details ref={mobileMenu} className="group relative lg:hidden"><summary className="grid size-11 list-none place-items-center rounded-full hover:bg-ink/6" aria-label={t("nav.menu")}><Menu className="size-5" /></summary><div className="absolute end-0 top-[calc(100%+1rem)] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface-strong p-3 shadow-lift"><form action={`/${locale}/search`} onSubmit={closeMobileMenu} className="relative mb-2"><label className="sr-only" htmlFor="mobile-search">{t("nav.search")}</label><input id="mobile-search" name="q" type="search" className="h-11 w-full rounded-xl border bg-canvas ps-10 pe-3 text-sm" placeholder={t("nav.search")} /><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" /></form>{[["nav.home", ""], ["nav.products", "/products"], ["nav.delivery", "/delivery"], ["nav.pickup", "/pickup"]].map(([label, path]) => <Link key={label} href={`/${locale}${path}`} onClick={closeMobileMenu} className="block rounded-xl px-4 py-3 text-sm font-bold hover:bg-canvas">{t(label ?? "")}</Link>)}<div className="my-2 border-t border-line" /><p className="px-4 py-2 text-xs font-black uppercase tracking-wider text-muted">{t("nav.categories")}</p><div className="grid grid-cols-2">{categories.map((category) => <Link key={category.id} href={`/${locale}/category/${category.slug}`} onClick={closeMobileMenu} className="rounded-lg px-4 py-2 text-sm hover:bg-canvas">{localize(category.name, locale)}</Link>)}</div><div className="mt-3 px-3 sm:hidden"><LanguageSwitcher locale={locale} /></div></div></details>
        </div>
      </div>
    </header>
  </>;
}
