import { LocationManager } from "@/components/admin/LocationManager";
import { PageHeader } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { getCurrency, listLocations } from "@/lib/admin/repository";

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) { const locale = getAdminLocale((await params).locale); const [cities, currency] = await Promise.all([listLocations(), getCurrency()]); return <><PageHeader title={locale === "ar" ? "المدن والمناطق ورسوم التوصيل" : "Cities, areas & delivery fees"} description={locale === "ar" ? "إدارة نطاق التوصيل والترتيب والتوفر والرسوم من قاعدة البيانات." : "Manage delivery coverage, ordering, availability, and fees from the database."} /><LocationManager locale={locale} cities={cities} currency={currency} /></>; }
