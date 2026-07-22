import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, currency = "ILS", locale = "en") {
  const numeric = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(locale === "ar" ? "ar-PS" : "en-PS", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function localizedField<T extends { nameAr?: string | null; nameEn?: string | null }>(
  item: T,
  locale: "ar" | "en",
) {
  return locale === "ar" ? item.nameAr || item.nameEn || "" : item.nameEn || item.nameAr || "";
}
