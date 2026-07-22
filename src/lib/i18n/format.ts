import type { Locale } from "./config";

export function formatMoney(value: number, locale: Locale, currency = "ILS"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-PS" : "en-PS", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatDate(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-PS" : "en-PS", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(value));
}

