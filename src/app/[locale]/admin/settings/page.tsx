import Link from "next/link";
import { SettingsForm, type AdminSettingsValues } from "@/components/admin/SettingsForm";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listSettings } from "@/lib/admin/repository";

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getAdminLocale((await params).locale); const settings = await listSettings(); const value = (key: string) => settings.find((item) => item.key === key)?.value; const profile = objectValue(value("store.profile")); const location = objectValue(value("store.location")); const hours = objectValue(value("store.openingHours")); const currency = objectValue(value("commerce.currency")); const promotion = objectValue(value("homepage.promotion")); const rawThreshold = value("inventory.defaultLowStockThreshold");
  const values: AdminSettingsValues = { profile: { nameAr: text(profile.nameAr, "JYS"), nameEn: text(profile.nameEn, "JYS"), phone: text(profile.phone), email: text(profile.email) }, location: { addressAr: text(location.addressAr), addressEn: text(location.addressEn), mapUrl: text(location.mapUrl) }, hours: { ar: text(hours.ar), en: text(hours.en) }, currency: { code: text(currency.code, "ILS"), symbolAr: text(currency.symbolAr, "₪"), symbolEn: text(currency.symbolEn, "₪") }, lowStock: typeof rawThreshold === "number" ? rawThreshold : 5, promotion: { titleAr: text(promotion.titleAr), titleEn: text(promotion.titleEn), bodyAr: text(promotion.bodyAr), bodyEn: text(promotion.bodyEn), imageUrl: text(promotion.imageUrl) } };
  return <><PageHeader title={locale === "ar" ? "إعدادات الموقع" : "Website settings"} description={locale === "ar" ? "إعدادات العمل العامة التي تظهر في المتجر وعند الاستلام. تُدار تعليمات التوصيل والاستلام ضمن المحتوى." : "Shared business settings shown in the storefront and pickup flow. Delivery and pickup instructions are managed in Content."} actions={<Link className={styles.buttonSecondary} href={`/${locale}/admin/content`}>{locale === "ar" ? "تعديل تعليمات التوصيل والاستلام" : "Edit delivery & pickup instructions"}</Link>} /><SettingsForm locale={locale} values={values} /></>;
}
