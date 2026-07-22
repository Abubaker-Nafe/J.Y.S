import { ContentManager } from "@/components/admin/ContentManager";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { getAdminLocale } from "@/lib/admin/i18n";
import { listContent } from "@/lib/admin/repository";
import type { AdminContentPage } from "@/lib/admin/types";

// Homepage hero copy and artwork are managed together under Settings. Keeping
// only routed policy pages here avoids two editors competing for the same UI.
const keys = ["TERMS", "PRIVACY", "NO_RETURN", "WARRANTY", "DELIVERY", "PICKUP"];
export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) { const locale = getAdminLocale((await params).locale); const existing = await listContent(); const pages = keys.map((key): AdminContentPage => existing.find((page) => page.key === key) ?? { id: "", key, slug: key.toLowerCase().replaceAll("_", "-"), titleAr: "", titleEn: "", bodyAr: "", bodyEn: "", active: false, updatedAt: new Date(0).toISOString() }); return <><PageHeader title={locale === "ar" ? "إدارة المحتوى" : "Content management"} description={locale === "ar" ? "حرر صفحات السياسات والمعلومات باللغتين دون ترجمة آلية." : "Edit policy and information pages in both languages without runtime machine translation."} />{pages.length ? <ContentManager locale={locale} pages={pages} /> : <div className={styles.emptyState}><p>{locale === "ar" ? "لا توجد صفحات محتوى." : "No content pages."}</p></div>}</>; }
