"use client";

import { useParams } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

export function LocalizedLoadingLabel({ admin = false }: { admin?: boolean }) {
  const params = useParams<{ locale?: string }>();
  const locale: Locale = isLocale(params.locale ?? "") ? (params.locale as Locale) : "en";
  const label = admin ? (locale === "ar" ? "جارٍ تحميل بيانات الإدارة…" : "Loading admin data…") : translate(locale, "common.loading");
  return <span className="sr-only">{label}</span>;
}
