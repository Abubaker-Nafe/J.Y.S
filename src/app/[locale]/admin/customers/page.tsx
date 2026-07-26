import Link from "next/link";
import { AdminPagination, EmptyState, PageHeader, adminStyles as styles } from "@/components/admin/AdminUi";
import { formatAdminDate, formatMoney } from "@/lib/admin/format";
import { getAdminLocale } from "@/lib/admin/i18n";
import { getCurrency, listCustomers } from "@/lib/admin/repository";

function customerType(locale: "ar" | "en", orderCount: number, lastOrderAt: string | null) {
  if (!lastOrderAt || Date.parse(lastOrderAt) < Date.now() - 90 * 86_400_000) return locale === "ar" ? "غير نشط" : "Inactive";
  return orderCount > 1 ? (locale === "ar" ? "عائد" : "Returning") : (locale === "ar" ? "جديد" : "New");
}

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string; search?: string }> }) {
  const locale = getAdminLocale((await params).locale); const query = await searchParams; const [customers, currency] = await Promise.all([listCustomers({ page: Number(query.page || 1), search: query.search }), getCurrency()]);
  const hrefFor = (page: number) => `?${new URLSearchParams({ ...(query.search ? { search: query.search } : {}), page: String(page) })}`;
  return <><PageHeader title={locale === "ar" ? "العملاء" : "Customers"} description={locale === "ar" ? "بيانات الحساب والطلبات والإنفاق دون عرض كلمات المرور أو رموز الأمان." : "Account, order, and spending information without exposing passwords or security tokens."} />
    <form className={styles.toolbar} method="get" role="search"><div className={`${styles.field} ${styles.fieldGrow}`}><label htmlFor="customer-search">{locale === "ar" ? "بحث" : "Search"}</label><input id="customer-search" className={styles.input} name="search" defaultValue={query.search} placeholder={locale === "ar" ? "الاسم أو البريد أو الهاتف" : "Name, email, or phone"} /></div><button className={styles.button} type="submit">{locale === "ar" ? "بحث" : "Search"}</button><Link className={styles.buttonSecondary} href={`/${locale}/admin/customers`}>{locale === "ar" ? "مسح" : "Clear"}</Link></form>
    <div className={styles.tableWrap}>{customers.items.length ? <table className={styles.table}><thead><tr><th>{locale === "ar" ? "العميل" : "Customer"}</th><th>{locale === "ar" ? "الهاتف" : "Phone"}</th><th>{locale === "ar" ? "المدينة" : "City"}</th><th>{locale === "ar" ? "تاريخ التسجيل" : "Registered"}</th><th>{locale === "ar" ? "الطلبات" : "Orders"}</th><th>{locale === "ar" ? "الإنفاق المكتمل" : "Fulfilled spend"}</th><th>{locale === "ar" ? "آخر طلب" : "Last order"}</th><th>{locale === "ar" ? "النوع" : "Type"}</th><th>{locale === "ar" ? "الإجراء" : "Action"}</th></tr></thead><tbody>{customers.items.map((customer) => <tr key={customer.id}><td className={styles.primaryCell}>{customer.name}<span className={styles.secondaryText} dir="ltr">{customer.email}</span></td><td dir="ltr">{customer.phone}</td><td>{customer.city ?? "—"}</td><td>{formatAdminDate(customer.joinedAt, locale)}</td><td>{customer.orderCount}</td><td>{formatMoney(customer.totalSpent, locale, currency)}</td><td>{customer.lastOrderAt ? formatAdminDate(customer.lastOrderAt, locale) : "—"}</td><td>{customerType(locale, customer.orderCount, customer.lastOrderAt)}</td><td><Link className={styles.buttonSecondary} href={`/${locale}/admin/customers/${customer.id}`}>{locale === "ar" ? "عرض" : "View"}</Link></td></tr>)}</tbody></table> : <EmptyState>{locale === "ar" ? "لا يوجد عملاء مطابقون." : "No customers match this search."}</EmptyState>}</div>
    <AdminPagination locale={locale} page={customers.page} pageCount={customers.pageCount} total={customers.total} hrefFor={hrefFor} label={locale === "ar" ? "صفحات العملاء" : "Customer pages"} previous={locale === "ar" ? "السابق" : "Previous"} next={locale === "ar" ? "التالي" : "Next"} pageLabel={locale === "ar" ? "صفحة" : "Page"} />
  </>;
}
