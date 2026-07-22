import type { Product } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/config";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, locale, headingLevel = 2 }: { products: Product[]; locale: Locale; headingLevel?: 2 | 3 }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{products.map((product, index) => <ProductCard key={product.id} product={product} locale={locale} priority={index < 4} headingLevel={headingLevel} />)}</div>;
}
