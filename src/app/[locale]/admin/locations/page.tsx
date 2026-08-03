import { LocationManager } from "@/components/admin/LocationManager";
import { PageHeader } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listLocations } from "@/lib/admin/repository";

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) { const locale = getAdminLocale((await params).locale); const cities = await listLocations(); return <><PageHeader title={locale === "ar" ? "مدن ومناطق التوصيل" : "Delivery cities & areas"} description={locale === "ar" ? "إدارة المدن والمناطق والترتيب والتوفر لجمع عناوين التوصيل." : "Manage cities, areas, ordering, and availability for delivery-address collection."} /><LocationManager locale={locale} cities={cities} /></>; }
