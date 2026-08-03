import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductDetailClient } from "@/components/storefront/product-detail-client";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ProductViewTracker } from "@/components/storefront/product-view-tracker";
import { EmptyState } from "@/components/ui/empty-state";
import { getStorefrontProduct } from "@/lib/catalog/server";
import { localize } from "@/lib/demo/catalog";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { getPublicBusinessSettings } from "@/lib/i18n/content";

type ProductPageParams = { params: Promise<{ locale: string; productId: string }> };

export async function generateMetadata({ params }: ProductPageParams): Promise<Metadata> {
  const { locale, productId } = await params;
  if (!isLocale(locale)) return {};
  const result = await getStorefrontProduct(productId);
  if (!result.product) return { title: locale === "ar" ? "المنتج غير موجود" : "Product not found" };
  return {
    title: localize(result.product.name, locale),
    description: localize(result.product.description, locale),
    alternates: { canonical: `/${locale}/product/${result.product.id}` },
  };
}

export default async function ProductPage({ params }: ProductPageParams) {
  const { locale, productId } = await params;
  if (!isLocale(locale)) notFound();
  const [result, business] = await Promise.all([getStorefrontProduct(productId), getPublicBusinessSettings(locale)]);
  if (result.source === "unavailable") {
    return <div className="container-shell py-16"><EmptyState title={locale === "ar" ? "تعذر تحميل المنتج" : "Product unavailable"} text={locale === "ar" ? "تعذر التحقق من سعر المنتج ومخزونه، لذلك لم نعرض بيانات احتياطية." : "Price and stock could not be verified, so no fallback product data was shown."} actionLabel={translate(locale, "common.retry")} actionHref={`/${locale}/product/${productId}`} /></div>;
  }
  if (!result.product) notFound();
  const { product, category, related } = result;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localize(product.name, locale),
    description: localize(product.description, locale),
    sku: product.sku,
    ...(product.images?.[0] ? { image: product.images[0] } : {}),
    offers: {
      "@type": "Offer",
      url: `/${locale}/product/${product.id}`,
      priceCurrency: business?.currency ?? "ILS",
      price: (product.effectivePrice ?? product.price).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(product.onSale && product.saleEndsAt ? { priceValidUntil: product.saleEndsAt.slice(0, 10) } : {}),
    },
  };
  return <div className="container-shell py-8 md:py-12"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} /><ProductViewTracker productId={product.id} /><nav aria-label={locale === "ar" ? "مسار التنقل" : "Breadcrumb"} className="mb-8 flex min-w-0 items-center gap-2 overflow-hidden text-xs font-semibold text-muted"><Link href={`/${locale}`}>{translate(locale, "nav.home")}</Link><ChevronRight className="size-3 shrink-0 rtl:rotate-180" /><Link href={`/${locale}/products`}>{translate(locale, "nav.products")}</Link>{category ? <><ChevronRight className="size-3 shrink-0 rtl:rotate-180" /><Link className="truncate" href={`/${locale}/category/${category.slug}`}>{localize(category.name, locale)}</Link></> : null}</nav><ProductDetailClient product={product} locale={locale} />{related.length ? <section className="mt-20 border-t border-line pt-14"><h2 className="mb-8 font-display text-3xl font-semibold md:text-4xl">{translate(locale, "product.related")}</h2><ProductGrid products={related} locale={locale} /></section> : null}</div>;
}
