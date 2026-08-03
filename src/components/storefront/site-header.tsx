"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, Search, Truck } from "lucide-react";
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
  const categoriesMenu = useRef<HTMLDivElement>(null);
  const categoriesButton = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesMenuId = useId();
  const closeMobileMenu = () => mobileMenu.current?.removeAttribute("open");
  const cancelClose = () => {
    if (!closeTimer.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openCategories = () => {
    cancelClose();
    setCategoriesOpen(true);
  };
  const closeCategories = (restoreFocus = false) => {
    cancelClose();
    setCategoriesOpen(false);
    if (restoreFocus) categoriesButton.current?.focus();
  };
  const scheduleCategoriesClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setCategoriesOpen(false), 180);
  };
  useEffect(() => () => cancelClose(), []);
  return <>
    <div className="safe-area-inline safe-area-top bg-brand-strong py-2 text-center text-xs font-semibold text-white/85"><span className="inline-flex max-w-full items-center gap-2"><Truck className="size-4 shrink-0 text-[#d59a67]" aria-hidden="true" /><span className="break-anywhere">{t("home.heroNote")}</span></span></div>
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/95 backdrop-blur-xl" data-no-print>
      <div className="container-shell flex h-[74px] min-w-0 items-center justify-between gap-1 sm:gap-3">
        <BrandMark locale={locale} />
        <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"} className="hidden items-center gap-1 lg:flex">
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}`}>{t("nav.home")}</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}/products`}>{t("nav.products")}</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-black text-accent hover:bg-accent/8" href={`/${locale}/on-sale`}>{t("nav.onSale")}</Link>
          <div
            ref={categoriesMenu}
            className="relative"
            onPointerEnter={openCategories}
            onPointerLeave={scheduleCategoriesClose}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeCategories();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeCategories(true);
              }
            }}
          >
            <button
              ref={categoriesButton}
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6"
              aria-expanded={categoriesOpen}
              aria-controls={categoriesMenuId}
              aria-haspopup="menu"
              onClick={() => setCategoriesOpen((open) => !open)}
            >
              {t("nav.categories")}
              <ChevronDown className={`size-3.5 transition ${categoriesOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div className={`absolute left-1/2 top-full w-[36rem] -translate-x-1/2 pt-2 ${categoriesOpen ? "block" : "hidden"}`}>
              <div id={categoriesMenuId} role="menu" aria-label={t("nav.categories")} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface-strong p-3 shadow-lift">
                <Link role="menuitem" href={`/${locale}/categories`} onClick={() => closeCategories()} className="col-span-2 rounded-xl border border-line px-4 py-3 text-sm font-black text-accent transition hover:bg-canvas">
                  {locale === "ar" ? "عرض جميع التصنيفات" : "View all categories"}
                </Link>
                {categories.map((category: Category) => <Link role="menuitem" key={category.id} href={`/${locale}/category/${category.slug}`} onClick={() => closeCategories()} className="group/item rounded-xl p-4 transition hover:bg-canvas"><span className="mb-2 block h-1 w-8 rounded-full transition-all group-hover/item:w-14" style={{ backgroundColor: category.accent }} /><strong className="block text-sm text-ink">{localize(category.name, locale)}</strong><small className="mt-1 block text-muted">{localize(category.description, locale)}</small></Link>)}
              </div>
            </div>
          </div>
          <Link className="rounded-full px-4 py-2 text-sm font-bold hover:bg-ink/6" href={`/${locale}/delivery`}>{t("nav.delivery")}</Link>
        </nav>
        <div className="flex min-w-0 shrink-0 items-center gap-0 sm:gap-1">
          <form action={`/${locale}/search`} className="relative hidden xl:block"><label className="sr-only" htmlFor="header-search">{t("nav.search")}</label><input id="header-search" name="q" type="search" className="h-10 w-52 rounded-full border border-line bg-surface ps-10 pe-4 text-sm outline-none transition focus:w-64 focus:border-accent focus:bg-white" placeholder={t("nav.search")} /><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" /></form>
          <div className="hidden sm:block"><LanguageSwitcher locale={locale} /></div><HeaderActions locale={locale} />
          <details ref={mobileMenu} className="group relative lg:hidden">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full hover:bg-ink/6" aria-label={t("nav.menu")}><Menu className="size-5" /></summary>
            <div className="absolute end-0 top-[calc(100%+1rem)] max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100dvw-2rem))] max-w-[calc(100dvw-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface-strong p-3 shadow-lift">
              <form action={`/${locale}/search`} onSubmit={closeMobileMenu} className="relative mb-2"><label className="sr-only" htmlFor="mobile-search">{t("nav.search")}</label><input id="mobile-search" name="q" type="search" className="h-11 w-full rounded-xl border bg-canvas ps-10 pe-3 text-base" placeholder={t("nav.search")} /><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" /></form>
              {[["nav.home", ""], ["nav.products", "/products"], ["nav.onSale", "/on-sale"], ["nav.delivery", "/delivery"], ["nav.pickup", "/pickup"]].map(([label, path]) => <Link key={label} href={`/${locale}${path}`} onClick={closeMobileMenu} className="block min-h-11 rounded-xl px-4 py-3 text-sm font-bold hover:bg-canvas">{t(label ?? "")}</Link>)}
              <div className="my-2 border-t border-line" />
              <Link href={`/${locale}/categories`} onClick={closeMobileMenu} className="block min-h-11 rounded-xl px-4 py-3 text-sm font-black text-accent hover:bg-canvas">{locale === "ar" ? "كل التصنيفات" : "All categories"}</Link>
              <p className="px-4 py-2 text-xs font-black uppercase tracking-wider text-muted">{t("nav.categories")}</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">{categories.map((category) => <Link key={category.id} href={`/${locale}/category/${category.slug}`} onClick={closeMobileMenu} className="min-h-11 rounded-lg px-4 py-2 text-sm hover:bg-canvas">{localize(category.name, locale)}</Link>)}</div>
              <div className="mt-3 px-3 sm:hidden"><LanguageSwitcher locale={locale} /></div>
            </div>
          </details>
        </div>
      </div>
    </header>
  </>;
}
