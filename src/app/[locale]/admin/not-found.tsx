"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";

export default function AdminNotFound() {
  const rawLocale = useParams<{ locale?: string }>().locale;
  const locale = rawLocale === "ar" ? "ar" : "en";
  return <><PageHeader title={locale === "ar" ? "السجل غير موجود" : "Record not found"} description={locale === "ar" ? "قد يكون السجل أُرشف أو أن الرابط لم يعد صالحًا." : "The record may have been archived or the link is no longer valid."} /><Link className={styles.button} href={`/${locale}/admin`}>{locale === "ar" ? "العودة إلى لوحة المعلومات" : "Back to dashboard"}</Link></>;
}
