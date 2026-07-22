import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/authorization";
import { getAdminLocale } from "@/lib/admin/i18n";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = getAdminLocale((await params).locale);
  const actor = await requireAdminPage(locale);
  return <AdminShell locale={locale} actor={actor}>{children}</AdminShell>;
}
