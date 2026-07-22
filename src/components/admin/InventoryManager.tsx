"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { localizedText } from "@/lib/admin/i18n";
import type { AdminInventoryRow, AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import { StatusBadge } from "./AdminUi";
import styles from "./admin.module.css";

export function InventoryManager({ locale, rows }: { locale: AdminLocale; rows: AdminInventoryRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminInventoryRow | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const data = new FormData(event.currentTarget); setPending(true); setResult(null);
    const response = await adminFetch("/api/admin/inventory", { method: "POST", body: JSON.stringify({ productId: selected.productId, variantId: selected.variantId, quantityDelta: Number(data.get("quantityDelta")), reason: data.get("reason") }) });
    setPending(false); setResult(response); if (response.ok) { setSelected(null); router.refresh(); }
  }
  return <>
    <MutationMessage result={result} locale={locale} />
    <div className={styles.tableWrap}>{rows.length ? <table className={styles.table}><thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>SKU</th><th>{locale === "ar" ? "الخيار" : "Variant"}</th><th>{locale === "ar" ? "المتاح" : "Available"}</th><th>{locale === "ar" ? "حد التنبيه" : "Alert threshold"}</th><th>{locale === "ar" ? "الحالة" : "State"}</th><th>{locale === "ar" ? "الإجراء" : "Action"}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className={styles.primaryCell}>{localizedText(locale, row.nameAr, row.nameEn)}</td><td dir="ltr">{row.sku}</td><td>{localizedText(locale, row.variantAr, row.variantEn)}</td><td className={styles.numeric}>{row.stock}</td><td>{row.lowStockThreshold}</td><td><StatusBadge label={row.stock <= 0 ? (locale === "ar" ? "نفد" : "Out of stock") : row.stock <= row.lowStockThreshold ? (locale === "ar" ? "منخفض" : "Low") : (locale === "ar" ? "جيد" : "Healthy")} tone={row.stock <= 0 ? "danger" : row.stock <= row.lowStockThreshold ? "warning" : "success"} /></td><td><button className={styles.buttonSecondary} type="button" onClick={() => { setResult(null); setSelected(row); }}>{locale === "ar" ? "تصحيح المخزون" : "Adjust stock"}</button></td></tr>)}</tbody></table> : <div className={styles.emptyState}><p>{locale === "ar" ? "لا توجد عناصر مطابقة." : "No inventory items match."}</p></div>}</div>
    {selected ? <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby="adjustment-heading"><div className={styles.cardHeader}><div><h2 id="adjustment-heading">{locale === "ar" ? "تصحيح يدوي للمخزون" : "Manual inventory adjustment"}</h2><p>{localizedText(locale, selected.nameAr, selected.nameEn)} · {selected.sku} · {locale === "ar" ? "الحالي" : "Current"}: {selected.stock}</p></div></div><form className={styles.form} onSubmit={submit}><div className={styles.formGrid}><div className={styles.field}><label htmlFor="quantityDelta">{locale === "ar" ? "مقدار التغيير" : "Quantity change"}</label><input id="quantityDelta" name="quantityDelta" className={styles.input} type="number" step="1" required placeholder={locale === "ar" ? "مثال: 5 أو -2" : "Example: 5 or -2"} /><span className={styles.helpText}>{locale === "ar" ? "استخدم قيمة موجبة للإضافة وسالبة للخصم." : "Use a positive value to add stock and a negative value to subtract."}</span></div><div className={styles.field}><label htmlFor="adjustment-reason">{locale === "ar" ? "السبب" : "Reason"}</label><textarea id="adjustment-reason" name="reason" className={styles.textarea} required minLength={3} maxLength={500} /></div></div><div className={styles.row}><button className={styles.button} type="submit" disabled={pending}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ التصحيح" : "Save adjustment")}</button><button className={styles.buttonSecondary} type="button" onClick={() => setSelected(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button></div></form></section> : null}
  </>;
}
