"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { adminStatusLabel } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import styles from "./admin.module.css";

const transitions: Record<string, readonly string[]> = {
  "DELIVERY:NEW": ["CONFIRMED", "CANCELLED"], "DELIVERY:CONFIRMED": ["PREPARING", "CANCELLED"], "DELIVERY:PREPARING": ["READY_FOR_DELIVERY", "CANCELLED"], "DELIVERY:READY_FOR_DELIVERY": ["SENT_TO_DELIVERY_COMPANY", "CANCELLED"], "DELIVERY:SENT_TO_DELIVERY_COMPANY": ["DELIVERED", "CANCELLED"],
  "PICKUP:NEW": ["CONFIRMED", "CANCELLED"], "PICKUP:CONFIRMED": ["PREPARING", "CANCELLED"], "PICKUP:PREPARING": ["READY_FOR_PICKUP", "CANCELLED"], "PICKUP:READY_FOR_PICKUP": ["COLLECTED", "CANCELLED"],
};
const paymentTransitions: Record<string, readonly string[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PENDING"],
  CANCELLED: ["PENDING"],
};

export function OrderActions({ id, locale, status, paymentStatus, fulfillment }: { id: string; locale: AdminLocale; status: string; paymentStatus: string; fulfillment: string }) {
  const router = useRouter(); const [result, setResult] = useState<ApiResult | null>(null); const [pending, setPending] = useState(false);
  const allowed = useMemo(() => transitions[`${fulfillment}:${status}`] ?? [], [fulfillment, status]);
  const allowedPayments = paymentTransitions[paymentStatus] ?? [];
  async function submit(event: FormEvent<HTMLFormElement>, kind: "status" | "paymentStatus") {
    event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get(kind) ?? ""); if (!value) return;
    if ((value === "CANCELLED" || kind === "paymentStatus" && value === "CANCELLED") && !window.confirm(locale === "ar" ? "تأكيد الإلغاء؟ لا يمكن التراجع عن تغيير حالة الطلب." : "Confirm cancellation? Order-status cancellation cannot be undone.")) return;
    setPending(true); setResult(null); const response = await adminFetch(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ [kind]: value, note: String(form.get("note") ?? "") }) }); setPending(false); setResult(response); if (response.ok) router.refresh();
  }
  return <section className={styles.card} aria-labelledby="order-actions-heading"><div className={styles.cardHeader}><div><h2 id="order-actions-heading">{locale === "ar" ? "تحديث الطلب" : "Update order"}</h2><p>{locale === "ar" ? "كل تغيير في حالة الطلب يُسجل باسم المدير ووقته." : "Every status change is recorded with the administrator and time."}</p></div></div><MutationMessage result={result} locale={locale} />
    {allowed.length ? <form className={styles.form} onSubmit={(event) => void submit(event, "status")}><div className={styles.field}><label htmlFor="next-status">{locale === "ar" ? "الحالة التالية" : "Next status"}</label><select id="next-status" name="status" className={styles.select} required defaultValue=""><option value="" disabled>{locale === "ar" ? "اختر الحالة" : "Choose status"}</option>{allowed.map((item) => <option value={item} key={item}>{adminStatusLabel(locale, item)}</option>)}</select></div><div className={styles.field}><label htmlFor="status-note">{locale === "ar" ? "ملاحظة داخلية (اختيارية)" : "Internal note (optional)"}</label><textarea id="status-note" name="note" className={styles.textarea} maxLength={1000} /></div><button className={styles.button} type="submit" disabled={pending}>{locale === "ar" ? "تحديث حالة الطلب" : "Update order status"}</button></form> : <div className={styles.infoBanner}>{locale === "ar" ? "وصل الطلب إلى حالة نهائية ولا توجد انتقالات أخرى." : "This order is in a final state and has no further transitions."}</div>}
    <hr className={styles.divider} />
    <form className={styles.row} onSubmit={(event) => void submit(event, "paymentStatus")}><div className={`${styles.field} ${styles.fieldGrow}`}><label htmlFor="payment-status">{locale === "ar" ? "حالة الدفع النقدي" : "Cash payment status"}</label><select id="payment-status" name="paymentStatus" className={styles.select} defaultValue="" required><option value="" disabled>{locale === "ar" ? "اختر الحالة التالية" : "Choose next status"}</option>{allowedPayments.map((item) => <option value={item} key={item}>{adminStatusLabel(locale, item)}</option>)}</select></div><button className={styles.buttonSecondary} type="submit" disabled={pending}>{locale === "ar" ? "حفظ حالة الدفع" : "Save payment status"}</button></form>
  </section>;
}
