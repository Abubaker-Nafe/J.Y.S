"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdminLocale } from "@/lib/admin/types";
import { formatMoney } from "@/lib/admin/format";
import styles from "./admin.module.css";

export function SalesChart({ data, locale, currency }: { data: Array<{ date: string; revenue: number; orders: number }>; locale: AdminLocale; currency: string }) {
  if (data.length === 0) return <div className={styles.emptyState}><p>{locale === "ar" ? "ستظهر المبيعات هنا بعد اكتمال الطلبات." : "Sales will appear here after orders are fulfilled."}</p></div>;
  return (
    <>
      <div className={styles.chart} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eae7" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={45} />
            <Tooltip formatter={(value) => formatMoney(Number(value), locale, currency)} contentStyle={{ borderRadius: 8, borderColor: "#dce2de" }} />
            <Bar dataKey="revenue" name={locale === "ar" ? "المبيعات" : "Revenue"} fill="#12654b" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className={styles.srOnly}>
        <caption>{locale === "ar" ? "بيانات المبيعات للفترة المعروضة" : "Sales data for the displayed period"}</caption>
        <thead><tr><th scope="col">{locale === "ar" ? "التاريخ" : "Date"}</th><th scope="col">{locale === "ar" ? "الإيراد" : "Revenue"}</th><th scope="col">{locale === "ar" ? "الطلبات" : "Orders"}</th></tr></thead>
        <tbody>{data.map((entry) => <tr key={entry.date}><th scope="row">{entry.date}</th><td>{formatMoney(entry.revenue, locale, currency)}</td><td>{entry.orders}</td></tr>)}</tbody>
      </table>
    </>
  );
}

export function ReportSalesChart({ data, locale, currency }: { data: Array<{ period: string; revenue: number; orders: number }>; locale: AdminLocale; currency: string }) {
  return <SalesChart data={data.map((entry) => ({ date: entry.period, revenue: entry.revenue, orders: entry.orders }))} locale={locale} currency={currency} />;
}
