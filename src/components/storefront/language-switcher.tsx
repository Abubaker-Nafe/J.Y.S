"use client";

import Link from "next/link";
import { Languages } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { alternateLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname(); const search = useSearchParams(); const nextLocale = alternateLocale(locale);
  const parts = pathname.split("/"); parts[1] = nextLocale; const href = `${parts.join("/")}${search.size ? `?${search.toString()}` : ""}`;
  return <Link href={href} hrefLang={nextLocale} lang={nextLocale} dir={nextLocale === "ar" ? "rtl" : "ltr"} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-black transition hover:border-ink/30 hover:bg-white"><Languages className="size-4" aria-hidden="true" />{translate(locale, "nav.language")}</Link>;
}

