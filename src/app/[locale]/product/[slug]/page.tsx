import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getStorefrontProduct } from "@/lib/catalog/server";
import { isLocale } from "@/lib/i18n/config";
import { localize } from "@/lib/demo/catalog";
import { translate } from "@/lib/i18n/dictionaries";
import { ProductDetailClient } from "@/components/storefront/product-detail-client";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ProductViewTracker } from "@/components/storefront/product-view-tracker";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getStorefrontProduct(slug);
  if (result.source === "unavailable") return <div className="container-shell py-16"><EmptyState title={locale === "ar" ? "تعذر تحميل المنتج" : "Product unavailable"} text={locale === "ar" ? "تعذر التحقق من سعر المنتج ومخزونه، لذلك لم نعرض بيانات احتياطية." : "Price and stock could not be verified, so no fallback product data was shown."} actionLabel={translate(locale, "common.retry")} actionHref={`/${locale}/product/${slug}`} /></div>;
  if (!result.product) notFound();
  const { product, category, related } = result;
  return <div className="container-shell py-8 md:py-12"><ProductViewTracker productId={product.id} /><nav aria-label={locale === "ar" ? "مسار التنقل" : "Breadcrumb"} className="mb-8 flex min-w-0 items-center gap-2 overflow-hidden text-xs font-semibold text-muted"><Link href={`/${locale}`}>{translate(locale, "nav.home")}</Link><ChevronRight className="size-3 shrink-0 rtl:rotate-180" /><Link href={`/${locale}/products`}>{translate(locale, "nav.products")}</Link>{category ? <><ChevronRight className="size-3 shrink-0 rtl:rotate-180" /><Link className="truncate" href={`/${locale}/category/${category.slug}`}>{localize(category.name, locale)}</Link></> : null}</nav><ProductDetailClient product={product} locale={locale} />{related.length ? <section className="mt-20 border-t border-line pt-14"><h2 className="mb-8 font-display text-3xl font-semibold md:text-4xl">{translate(locale, "product.related")}</h2><ProductGrid products={related} locale={locale} /></section> : null}</div>;
}
