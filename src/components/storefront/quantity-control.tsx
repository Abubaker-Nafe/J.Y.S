import { Minus, Plus } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

export function QuantityControl({ value, min = 1, max, onChange, label, locale }: { value: number; min?: number; max: number; onChange: (value: number) => void; label: string; locale?: Locale }) {
  const isArabic = locale === "ar" || /[\u0600-\u06ff]/.test(label);
  const decrease = isArabic ? `تقليل ${label}` : `Decrease ${label}`;
  const increase = isArabic ? `زيادة ${label}` : `Increase ${label}`;
  return <div className="inline-flex h-12 items-center overflow-hidden rounded-full border border-line bg-surface-strong"><button type="button" className="grid h-full w-11 place-items-center transition hover:bg-canvas disabled:opacity-35" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={decrease}><Minus className="size-4" aria-hidden="true" /></button><output className="min-w-9 text-center text-sm font-black" aria-live="polite" aria-atomic="true">{value}</output><button type="button" className="grid h-full w-11 place-items-center transition hover:bg-canvas disabled:opacity-35" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={increase}><Plus className="size-4" aria-hidden="true" /></button></div>;
}
