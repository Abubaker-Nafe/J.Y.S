"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useParams<{ locale?: string }>().locale === "ar" ? "ar" : "en";
  useEffect(() => { console.error("Admin screen error", { name: error.name, digest: error.digest }); }, [error]);
  return (
    <div>
      <PageHeader title={locale === "ar" ? "بيانات الإدارة غير متاحة" : "Admin data unavailable"} description={locale === "ar" ? "تعذر تحميل أحدث البيانات. لم تتغير السجلات المحفوظة." : "The dashboard could not load its latest data. Your stored records have not been changed."} />
      <div className={styles.errorBanner} role="alert">{locale === "ar" ? "تحقق من اتصال قاعدة البيانات، ثم أعد المحاولة." : "Check the database connection, then retry this screen."}</div>
      <button className={styles.button} type="button" onClick={reset}>{locale === "ar" ? "المحاولة مجددًا" : "Try again"}</button>
    </div>
  );
}
