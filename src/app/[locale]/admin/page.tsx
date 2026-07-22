import Link from "next/link";
import { PageHeader, MetricCard, StatusBadge, adminStyles as styles, statusTone } from "@/components/admin/AdminUi";
import { SalesChart } from "@/components/admin/DashboardCharts";
import { formatAdminDate, formatMoney } from "@/lib/admin/format";
import { adminMessages, adminStatusLabel, getAdminLocale, localizedText } from "@/lib/admin/i18n";
import { getCurrency, getDashboardData } from "@/lib/admin/repository";

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getAdminLocale((await params).locale);
  const t = adminMessages[locale];
  const [data, currency] = await Promise.all([getDashboardData(), getCurrency()]);
  const labels = locale === "ar" ? {
    title: "لوحة المعلومات", description: "نظرة مباشرة على المبيعات والطلبات والمخزون الذي يحتاج إلى متابعة.", totalSales: "إجمالي المبيعات المكتملة", today: "طلبات اليوم", week: "طلبات هذا الأسبوع", month: "طلبات هذا الشهر", average: "متوسط قيمة الطلب", newOrders: "طلبات جديدة", low: "مخزون منخفض", out: "نفد من المخزون", sales: "المبيعات خلال 14 يومًا", recent: "أحدث الطلبات", stock: "تنبيهات المخزون", order: "الطلب", customer: "العميل", total: "الإجمالي", status: "الحالة", available: "المتاح", allOrders: "كل الطلبات", inventory: "إدارة المخزون",
  } : {
    title: "Dashboard", description: "A live view of sales, orders, and inventory that needs attention.", totalSales: "Fulfilled sales", today: "Orders today", week: "Orders this week", month: "Orders this month", average: "Average order value", newOrders: "New orders", low: "Low stock", out: "Out of stock", sales: "Sales over 14 days", recent: "Recent orders", stock: "Stock alerts", order: "Order", customer: "Customer", total: "Total", status: "Status", available: "Available", allOrders: "All orders", inventory: "Manage inventory",
  };
  return (
    <>
      <PageHeader title={labels.title} description={labels.description} actions={<Link className={styles.button} href={`/${locale}/admin/products/new`}>{t.newProduct}</Link>} />
      <section className={`${styles.grid} ${styles.metrics}`} aria-label={locale === "ar" ? "المؤشرات الرئيسية" : "Key metrics"}>
        <MetricCard label={labels.totalSales} value={formatMoney(data.metrics.totalSales, locale, currency)} tone="success" />
        <MetricCard label={labels.today} value={String(data.metrics.ordersToday)} />
        <MetricCard label={labels.week} value={String(data.metrics.ordersWeek)} />
        <MetricCard label={labels.month} value={String(data.metrics.ordersMonth)} />
        <MetricCard label={labels.average} value={formatMoney(data.metrics.averageOrderValue, locale, currency)} />
        <MetricCard label={labels.newOrders} value={String(data.metrics.newOrders)} tone={data.metrics.newOrders ? "warning" : "default"} />
        <MetricCard label={labels.low} value={String(data.metrics.lowStock)} tone={data.metrics.lowStock ? "warning" : "default"} />
        <MetricCard label={labels.out} value={String(data.metrics.outOfStock)} tone={data.metrics.outOfStock ? "danger" : "default"} />
      </section>
      <section className={`${styles.grid} ${styles.twoColumn} ${styles.sectionGap}`}>
        <article className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{labels.sales}</h2><p>{locale === "ar" ? "تُحتسب الطلبات التي تم توصيلها أو استلامها فقط." : "Counts delivered or collected orders only."}</p></div></div>
          <SalesChart data={data.salesSeries} locale={locale} currency={currency} />
        </article>
        <article className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{locale === "ar" ? "ملخص حالات الطلب" : "Order status summary"}</h2></div></div>
          {data.statusSummary.length ? <ul className={styles.statusList}>{data.statusSummary.map((item) => <li className={styles.statusRow} key={item.status}><StatusBadge label={adminStatusLabel(locale, item.status)} tone={statusTone(item.status)} /><span className={styles.statusCount}>{item.count}</span></li>)}</ul> : <div className={styles.emptyState}><p>{t.empty}</p></div>}
        </article>
      </section>
      <section className={`${styles.grid} ${styles.twoColumn} ${styles.sectionGap}`}>
        <article className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{labels.recent}</h2></div><Link className={styles.buttonGhost} href={`/${locale}/admin/orders`}>{labels.allOrders}</Link></div>
          {data.recentOrders.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{labels.order}</th><th>{labels.customer}</th><th>{labels.total}</th><th>{labels.status}</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order.id}><td className={styles.primaryCell}><Link href={`/${locale}/admin/orders/${order.id}`}>{order.orderNumber}</Link><span className={styles.secondaryText}>{formatAdminDate(order.createdAt, locale, true)}</span></td><td>{order.customerName}</td><td className={styles.numeric}>{formatMoney(order.total, locale, order.currency)}</td><td><StatusBadge label={adminStatusLabel(locale, order.status)} tone={statusTone(order.status)} /></td></tr>)}</tbody></table></div> : <div className={styles.emptyState}><p>{t.empty}</p></div>}
        </article>
        <article className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{labels.stock}</h2></div><Link className={styles.buttonGhost} href={`/${locale}/admin/inventory`}>{labels.inventory}</Link></div>
          {data.stockAlerts.length ? <ul className={styles.statusList}>{data.stockAlerts.map((item) => <li className={styles.statusRow} key={item.id}><span><strong>{localizedText(locale, item.nameAr, item.nameEn)}</strong><span className={styles.secondaryText}>{item.sku}</span></span><StatusBadge label={`${labels.available}: ${item.stock}`} tone={item.stock <= 0 ? "danger" : "warning"} /></li>)}</ul> : <div className={styles.emptyState}><p>{locale === "ar" ? "المخزون ضمن الحدود الآمنة." : "Inventory is within safe thresholds."}</p></div>}
        </article>
      </section>
    </>
  );
}
