import { notFound } from "next/navigation";
import { CategoryGrid } from "@/components/storefront/category-grid";
import { PageHeading } from "@/components/ui/page-heading";
import { getStorefrontCategories } from "@/lib/catalog/server";
import { isLocale } from "@/lib/i18n/config";

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const catalog = await getStorefrontCategories();

  return (
    <div className="container-shell py-12 md:py-16">
      <PageHeading
        title={raw === "ar" ? "تصفّح التصنيفات" : "Browse categories"}
        description={raw === "ar" ? "اختر القسم المناسب وانتقل مباشرة إلى منتجاته المتاحة." : "Choose a department and go directly to its available products."}
      />
      {catalog.source === "unavailable" ? (
        <div role="alert" className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-900">
          {raw === "ar" ? "تعذر تحميل التصنيفات من قاعدة البيانات. حاول مجددًا لاحقًا." : "Categories could not be loaded from the database. Please try again later."}
        </div>
      ) : catalog.categories.length ? (
        <div className="mt-10"><CategoryGrid locale={raw} categories={catalog.categories} /></div>
      ) : (
        <p className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center text-muted">
          {raw === "ar" ? "لا توجد تصنيفات متاحة حاليًا." : "No categories are currently available."}
        </p>
      )}
    </div>
  );
}
