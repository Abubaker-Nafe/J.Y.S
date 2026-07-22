import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { getAdminLocale, localizedText } from "@/lib/admin/i18n";
import { getProduct, listCategories } from "@/lib/admin/repository";

export default async function EditProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeParam, id } = await params;
  const locale = getAdminLocale(localeParam);
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!product) notFound();
  return <><PageHeader title={localizedText(locale, product.nameAr, product.nameEn)} description={`${product.sku} · ${locale === "ar" ? "آخر تعديل" : "Last updated"} ${new Intl.DateTimeFormat(locale === "ar" ? "ar-PS" : "en-PS").format(new Date(product.updatedAt))}`} actions={<Link className={styles.buttonSecondary} href={`/${locale}/admin/products`}>{locale === "ar" ? "العودة للمنتجات" : "Back to products"}</Link>} />{product.archivedAt ? <div className={styles.errorBanner}>{locale === "ar" ? "هذا المنتج مؤرشف. استعده من قائمة المنتجات قبل التعديل." : "This product is archived. Restore it from the product list before editing."}</div> : <ProductForm locale={locale} categories={categories} product={product} />}</>;
}
