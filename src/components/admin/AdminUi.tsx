import type { ReactNode } from "react";
import Link from "next/link";
import type { AdminLocale } from "@/lib/admin/types";
import styles from "./admin.module.css";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.emptyState}><p>{children}</p></div>;
}

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? styles.badgeSuccess : tone === "warning" ? styles.badgeWarning : tone === "danger" ? styles.badgeDanger : "";
  return <span className={`${styles.badge} ${toneClass}`}><span className={styles.dot} aria-hidden="true" />{label}</span>;
}

export function statusTone(value: string): "default" | "success" | "warning" | "danger" {
  if (["DELIVERED", "COLLECTED", "PAID", "ACTIVE", "CONFIRMED"].includes(value)) return "success";
  if (["CANCELLED", "OUT_OF_STOCK", "ARCHIVED"].includes(value)) return "danger";
  if (["NEW", "PENDING", "PREPARING", "LOW_STOCK"].includes(value)) return "warning";
  return "default";
}

export function MetricCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? styles.toneSuccess : tone === "warning" ? styles.toneWarning : tone === "danger" ? styles.toneDanger : "";
  return <article className={`${styles.card} ${toneClass}`}><span className={styles.metricLabel}>{label}</span><strong className={styles.metricValue}>{value}</strong>{hint ? <span className={styles.metricHint}>{hint}</span> : null}</article>;
}

export function AdminPagination({ locale, page, pageCount, total, hrefFor, label, previous, next, pageLabel, ofLabel = "/" }: { locale: AdminLocale; page: number; pageCount: number; total: number; hrefFor: (page: number) => string; label: string; previous: string; next: string; pageLabel: string; ofLabel?: string }) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const previousLabel = locale === "ar" ? `الانتقال إلى الصفحة ${page - 1}` : `Go to page ${page - 1}`;
  const nextLabel = locale === "ar" ? `الانتقال إلى الصفحة ${page + 1}` : `Go to page ${page + 1}`;
  return (
    <nav className={styles.pagination} aria-label={label} dir="ltr">
      {page <= 1 ? <span className={styles.buttonSecondary} aria-disabled="true"><span dir={direction}>{previous}</span></span> : <Link className={styles.buttonSecondary} href={hrefFor(page - 1)} aria-label={previousLabel}><span dir={direction}>{previous}</span></Link>}
      <span aria-current="page" aria-label={locale === "ar" ? `الصفحة ${page} من ${pageCount}، ${total} نتيجة` : `Page ${page} of ${pageCount}, ${total} results`}><span dir={direction}>{pageLabel}</span> {page} {ofLabel} {pageCount} · {total}</span>
      {page >= pageCount ? <span className={styles.buttonSecondary} aria-disabled="true"><span dir={direction}>{next}</span></span> : <Link className={styles.buttonSecondary} href={hrefFor(page + 1)} aria-label={nextLabel}><span dir={direction}>{next}</span></Link>}
    </nav>
  );
}

export { styles as adminStyles };
