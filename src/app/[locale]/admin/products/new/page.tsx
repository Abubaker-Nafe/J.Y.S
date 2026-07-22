import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listCategories, listSettings } from "@/lib/admin/repository";

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getAdminLocale((await params).locale);
  const [categories, settings] = await Promise.all([listCategories(), listSettings()]);
  const configuredThreshold = settings.find((item) => item.key === "inventory.defaultLowStockThreshold")?.value;
  const defaultLowStockThreshold = typeof configuredThreshold === "number" ? configuredThreshold : 5;
  return <><PageHeader title={locale === "ar" ? "إضافة منتج" : "Create product"} description={locale === "ar" ? "أدخل بيانات المنتج وخياراته وصوره." : "Add product details, variants, and images."} actions={<Link className={styles.buttonSecondary} href={`/${locale}/admin/products`}>{locale === "ar" ? "العودة للمنتجات" : "Back to products"}</Link>} />{categories.length ? <ProductForm locale={locale} categories={categories} defaultLowStockThreshold={defaultLowStockThreshold} /> : <div className={styles.infoBanner}>{locale === "ar" ? "أنشئ تصنيفًا أولًا قبل إضافة منتج." : "Create a category before adding a product."} <Link href={`/${locale}/admin/categories`}>{locale === "ar" ? "إدارة التصنيفات" : "Manage categories"}</Link></div>}</>;
}
