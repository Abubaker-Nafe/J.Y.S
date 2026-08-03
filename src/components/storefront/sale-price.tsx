import type { Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/i18n/format";
import { translate } from "@/lib/i18n/dictionaries";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SaleBadge({ locale, percentage, className }: { locale: Locale; percentage: number; className?: string }) {
  const rounded = Math.round(percentage);
  return <Badge tone="danger" className={className}>{translate(locale, "sale.badge", { percent: rounded })}</Badge>;
}

export function SalePrice({ locale, currency, normalPrice, effectivePrice, className }: { locale: Locale; currency: string; normalPrice: number; effectivePrice: number; className?: string }) {
  const onSale = effectivePrice < normalPrice;
  if (!onSale) return <strong className={cn("block text-lg font-black text-ink", className)}>{formatMoney(normalPrice, locale, currency)}</strong>;
  return <span className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
    <span className="sr-only">{translate(locale, "sale.originalPrice")}: </span>
    <del className="text-sm font-semibold text-muted decoration-2">{formatMoney(normalPrice, locale, currency)}</del>
    <span className="sr-only"> {translate(locale, "sale.finalPrice")}: </span>
    <strong className="text-lg font-black text-accent">{formatMoney(effectivePrice, locale, currency)}</strong>
  </span>;
}
