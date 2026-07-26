"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatAdminDate } from "@/lib/admin/format";
import { localizedText } from "@/lib/admin/i18n";
import type { AdminInventoryAdjustment, AdminInventoryRow, AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import { EmptyState, StatusBadge } from "./AdminUi";
import styles from "./admin.module.css";

export function InventoryManager({
  locale,
  rows,
  history,
}: {
  locale: AdminLocale;
  rows: AdminInventoryRow[];
  history: AdminInventoryAdjustment[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminInventoryRow | null>(null);
  const [mode, setMode] = useState<"DELTA" | "SET_EXACT">("DELTA");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const adjustmentPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selected) return;
    const frame = window.requestAnimationFrame(() => {
      adjustmentPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      adjustmentPanel.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    try {
      const response = await adminFetch("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({
          productId: selected.productId,
          variantId: selected.variantId,
          mode,
          ...(mode === "DELTA"
            ? { quantityDelta: Number(data.get("quantityDelta")) }
            : { targetStock: Number(data.get("targetStock")) }),
          reason: data.get("reason"),
        }),
      });
      setResult(response);
      if (response.ok) {
        setSelected(null);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <MutationMessage result={result} locale={locale} />
      <div className={styles.tableWrap}>
        {rows.length ? (
          <table className={styles.table}>
            <thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>SKU</th><th>{locale === "ar" ? "الخيار" : "Variant"}</th><th>{locale === "ar" ? "المتاح" : "Available"}</th><th>{locale === "ar" ? "حد التنبيه" : "Alert threshold"}</th><th>{locale === "ar" ? "الحالة" : "State"}</th><th>{locale === "ar" ? "الإجراء" : "Action"}</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.primaryCell}>{localizedText(locale, row.nameAr, row.nameEn)}</td>
                  <td dir="ltr">{row.sku}</td>
                  <td>{localizedText(locale, row.variantAr, row.variantEn)}</td>
                  <td className={styles.numeric}>{row.stock}</td>
                  <td>{row.lowStockThreshold}</td>
                  <td><StatusBadge label={row.stock <= 0 ? (locale === "ar" ? "نفد" : "Out of stock") : row.stock <= row.lowStockThreshold ? (locale === "ar" ? "منخفض" : "Low") : (locale === "ar" ? "جيد" : "Healthy")} tone={row.stock <= 0 ? "danger" : row.stock <= row.lowStockThreshold ? "warning" : "success"} /></td>
                  <td><button className={styles.buttonSecondary} type="button" onClick={() => { setResult(null); setSelected(row); }}>{locale === "ar" ? "تصحيح المخزون" : "Adjust stock"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState>{locale === "ar" ? "لا توجد عناصر مطابقة." : "No inventory items match."}</EmptyState>}
      </div>

      {selected ? (
        <section ref={adjustmentPanel} tabIndex={-1} className={`${styles.card} ${styles.sectionGap}`} aria-labelledby="adjustment-heading">
          <div className={styles.cardHeader}><div><h2 id="adjustment-heading">{locale === "ar" ? "تصحيح يدوي للمخزون" : "Manual inventory adjustment"}</h2><p>{localizedText(locale, selected.nameAr, selected.nameEn)} · {selected.sku} · {locale === "ar" ? "الحالي" : "Current"}: {selected.stock}</p></div></div>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="adjustment-mode">{locale === "ar" ? "طريقة التصحيح" : "Adjustment method"}</label>
                <select id="adjustment-mode" className={styles.select} value={mode} onChange={(event) => setMode(event.target.value as "DELTA" | "SET_EXACT")}>
                  <option value="DELTA">{locale === "ar" ? "زيادة أو نقصان" : "Increase or decrease"}</option>
                  <option value="SET_EXACT">{locale === "ar" ? "تعيين قيمة دقيقة" : "Set exact stock"}</option>
                </select>
              </div>
              {mode === "DELTA" ? (
                <div className={styles.field}>
                  <label htmlFor="quantityDelta">{locale === "ar" ? "مقدار التغيير" : "Quantity change"}</label>
                  <input id="quantityDelta" name="quantityDelta" className={styles.input} type="number" step="1" required placeholder={locale === "ar" ? "مثال: 5 أو -2" : "Example: 5 or -2"} />
                  <span className={styles.helpText}>{locale === "ar" ? "استخدم قيمة موجبة للإضافة وسالبة للخصم." : "Use a positive value to add stock and a negative value to subtract."}</span>
                </div>
              ) : (
                <div className={styles.field}>
                  <label htmlFor="targetStock">{locale === "ar" ? "المخزون الجديد" : "Exact new stock"}</label>
                  <input id="targetStock" name="targetStock" className={styles.input} type="number" min="0" step="1" required defaultValue={selected.stock} />
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="adjustment-reason">{locale === "ar" ? "السبب" : "Reason"}</label>
                <textarea id="adjustment-reason" name="reason" className={styles.textarea} required minLength={3} maxLength={500} />
              </div>
            </div>
            <div className={styles.row}>
              <button className={styles.button} type="submit" disabled={pending}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ التصحيح" : "Save adjustment")}</button>
              <button className={styles.buttonSecondary} type="button" onClick={() => setSelected(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby="inventory-history-heading">
        <div className={styles.cardHeader}><div><h2 id="inventory-history-heading">{locale === "ar" ? "سجل تعديلات المخزون" : "Inventory adjustment history"}</h2><p>{locale === "ar" ? "آخر 100 تعديل، بما في ذلك تغييرات الطلبات والتصحيحات اليدوية." : "The latest 100 changes, including order movements and manual corrections."}</p></div></div>
        <div className={styles.infoBanner}>
          {locale === "ar"
            ? <><strong>السابق:</strong> كمية المخزون قبل التعديل. <strong>التغيير:</strong> المقدار المضاف أو المخصوم؛ القيمة الموجبة تزيد المخزون والسالبة تنقصه. <strong>الجديد:</strong> الكمية بعد تطبيق التعديل.</>
            : <><strong>Previous:</strong> Stock quantity before the adjustment. <strong>Delta:</strong> Amount added or removed; positive increases stock and negative decreases it. <strong>New:</strong> Stock quantity after applying the adjustment.</>}
        </div>
        {history.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>SKU</th><th>{locale === "ar" ? "السابق" : "Previous"}</th><th>{locale === "ar" ? "التغيير" : "Delta"}</th><th>{locale === "ar" ? "الجديد" : "New"}</th><th>{locale === "ar" ? "السبب" : "Reason"}</th><th>{locale === "ar" ? "المسؤول" : "Administrator"}</th><th>{locale === "ar" ? "التاريخ" : "Date"}</th></tr></thead>
              <tbody>{history.map((entry) => <tr key={entry.id}><td className={styles.primaryCell}>{localizedText(locale, entry.productNameAr, entry.productNameEn)}{entry.variantId ? <span className={styles.secondaryText}>{localizedText(locale, entry.variantAr, entry.variantEn)}</span> : null}</td><td dir="ltr">{entry.sku}</td><td>{entry.previousStock ?? "—"}</td><td className={styles.numeric}>{entry.quantityDelta > 0 ? `+${entry.quantityDelta}` : entry.quantityDelta}</td><td>{entry.newStock ?? "—"}</td><td>{entry.reason}</td><td>{entry.admin}</td><td>{formatAdminDate(entry.createdAt, locale)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState>{locale === "ar" ? "لا توجد تعديلات مسجلة بعد." : "No inventory adjustments have been recorded yet."}</EmptyState>}
      </section>
    </>
  );
}
