import Link from "next/link";
import { ArrowUpRight, Scissors } from "lucide-react";
import type { Category } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";

export function CategoryGrid({ locale, categories }: { locale: Locale; categories: Category[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category, index) => <Link key={category.id} href={`/${locale}/category/${category.slug}`} className="group relative min-h-48 overflow-hidden rounded-2xl border border-ink/10 bg-brand-strong p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lift"><div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at ${index % 2 ? "15%" : "85%"} 20%, ${category.accent}99, transparent 45%)` }} /><Scissors className={`absolute -bottom-5 size-32 stroke-[.7] text-white/10 transition group-hover:scale-110 ${index % 2 ? "-start-3 rotate-12" : "-end-3 -rotate-12"}`} aria-hidden="true" /><div className="relative flex h-full flex-col"><span className="mb-8 h-1 w-10 rounded-full" style={{ backgroundColor: category.accent }} /><h3 className="mt-auto font-display text-2xl font-semibold">{localize(category.name, locale)}</h3><div className="mt-2 flex items-end justify-between gap-3"><p className="text-sm text-white/80">{localize(category.description, locale)}</p><ArrowUpRight className="size-5 shrink-0 transition group-hover:-translate-y-1 group-hover:translate-x-1 rtl:-scale-x-100" aria-hidden="true" /></div></div></Link>)}</div>;
}
