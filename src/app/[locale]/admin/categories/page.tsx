import { CategoryManager } from "@/components/admin/CategoryManager";
import { PageHeader } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listCategories } from "@/lib/admin/repository";

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getAdminLocale((await params).locale);
  const categories = await listCategories(true);
  return <><PageHeader title={locale === "ar" ? "التصنيفات" : "Categories"} description={locale === "ar" ? "نظم المنتجات بتصنيفات ثنائية اللغة وحدد ترتيب ظهورها في المتجر." : "Organize products with bilingual categories and control storefront order."} /><CategoryManager locale={locale} categories={categories} /></>;
}
