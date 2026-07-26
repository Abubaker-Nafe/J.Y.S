import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";

export function BrandMark({ locale, inverted = false }: { locale: Locale; inverted?: boolean }) {
  return (
    <Link href={`/${locale}`} className="group inline-flex items-center gap-3" aria-label={locale === "ar" ? "الصفحة الرئيسية لـ JYS" : "JYS home"}>
      <span className={`relative grid size-11 place-items-center overflow-hidden rounded-xl border font-black tracking-[-0.12em] transition group-hover:-rotate-2 ${inverted ? "border-white/30 bg-white text-brand-strong" : "border-ink/15 bg-brand-strong text-white"}`}><span className="-ms-0.5 text-base">JYS</span><span className="absolute bottom-1 h-px w-5 bg-accent" /></span>
      <span className="hidden flex-col leading-none sm:flex"><strong className={`text-xl font-black tracking-[0.12em] ${inverted ? "text-white" : "text-ink"}`}>JYS</strong><small className={`mt-1 text-[10px] font-bold uppercase tracking-[.12em] ${inverted ? "text-white/80" : "text-muted"}`}>Barber supply</small></span>
    </Link>
  );
}
