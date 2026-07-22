"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { AdminCategory, AdminLocale } from "@/lib/admin/types";
import { adminFetch, ConfirmAction, MutationMessage, type ApiResult } from "./MutationFeedback";
import styles from "./admin.module.css";

const empty: AdminCategory = { id: "", archivedAt: null, nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", slug: "", active: true, displayOrder: 0, productCount: 0 };

export function CategoryManager({ locale, categories }: { locale: AdminLocale; categories: AdminCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    const response = await adminFetch<{ id: string }>(editing.id ? `/api/admin/categories/${editing.id}` : "/api/admin/categories", {
      method: editing.id ? "PATCH" : "POST",
      body: JSON.stringify({ nameAr: data.get("nameAr"), nameEn: data.get("nameEn"), descriptionAr: data.get("descriptionAr"), descriptionEn: data.get("descriptionEn"), slug: data.get("slug"), active: data.get("active") === "on", displayOrder: Number(data.get("displayOrder")) }),
    });
    setPending(false);
    setResult(response);
    if (response.ok) { setEditing(null); router.refresh(); }
  }

  return (
    <>
      <div className={styles.rowBetween}>
        <p className={styles.helpText}>{locale === "ar" ? `${categories.length} تصنيفات` : `${categories.length} categories`}</p>
        <button className={styles.button} type="button" onClick={() => { setResult(null); setEditing(empty); }}><Plus size={17} />{locale === "ar" ? "تصنيف جديد" : "New category"}</button>
      </div>
      <MutationMessage result={result} locale={locale} />
      <div className={`${styles.tableWrap} ${styles.sectionGap}`}>
        {categories.length ? (
          <table className={styles.table}>
            <thead><tr><th>{locale === "ar" ? "التصنيف" : "Category"}</th><th>{locale === "ar" ? "الرابط" : "Slug"}</th><th>{locale === "ar" ? "الترتيب" : "Order"}</th><th>{locale === "ar" ? "المنتجات" : "Products"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "الإجراءات" : "Actions"}</th></tr></thead>
            <tbody>{categories.map((category) => (
              <tr key={category.id}>
                <td className={styles.primaryCell}>{locale === "ar" ? category.nameAr || category.nameEn : category.nameEn || category.nameAr}<span className={styles.secondaryText}>{locale === "ar" ? category.descriptionAr || category.descriptionEn : category.descriptionEn || category.descriptionAr}</span></td>
                <td dir="ltr">/{category.slug}</td><td>{category.displayOrder}</td><td>{category.productCount}</td>
                <td>{category.archivedAt ? (locale === "ar" ? "مؤرشف" : "Archived") : category.active ? (locale === "ar" ? "نشط" : "Active") : (locale === "ar" ? "غير نشط" : "Inactive")}</td>
                <td><div className={styles.tableActions}>{category.archivedAt ? (
                  <ConfirmAction locale={locale} label={locale === "ar" ? "استعادة" : "Restore"} confirmMessage={locale === "ar" ? "استعادة التصنيف كغير نشط؟" : "Restore this category as inactive?"} url={`/api/admin/categories/${category.id}/restore`} method="POST" onSuccess={() => router.refresh()} />
                ) : <><button className={styles.buttonSecondary} type="button" onClick={() => { setResult(null); setEditing(category); }}>{locale === "ar" ? "تعديل" : "Edit"}</button><ConfirmAction danger locale={locale} label={locale === "ar" ? "أرشفة" : "Archive"} confirmMessage={locale === "ar" ? "أرشفة التصنيف؟ ستظل المنتجات المرتبطة محفوظة." : "Archive this category? Linked products remain stored."} url={`/api/admin/categories/${category.id}`} onSuccess={() => router.refresh()} /></>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className={styles.emptyState}><p>{locale === "ar" ? "لا توجد تصنيفات بعد." : "No categories yet."}</p></div>}
      </div>
      {editing ? (
        <div className={styles.card} role="region" aria-labelledby="category-editor-heading">
          <div className={styles.cardHeader}><div><h2 id="category-editor-heading">{editing.id ? (locale === "ar" ? "تعديل التصنيف" : "Edit category") : (locale === "ar" ? "تصنيف جديد" : "New category")}</h2></div></div>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.formGrid}><FormField name="nameAr" label="الاسم بالعربية" value={editing.nameAr} dir="rtl" /><FormField name="nameEn" label="English name" value={editing.nameEn} dir="ltr" /><FormField name="slug" label={locale === "ar" ? "الرابط المختصر" : "URL slug"} value={editing.slug} dir="ltr" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /><FormField name="displayOrder" label={locale === "ar" ? "ترتيب العرض" : "Display order"} value={String(editing.displayOrder)} type="number" min="0" /></div>
            <div className={styles.formGrid}><TextField name="descriptionAr" label="الوصف بالعربية" value={editing.descriptionAr} dir="rtl" /><TextField name="descriptionEn" label="English description" value={editing.descriptionEn} dir="ltr" /></div>
            <label className={styles.checkbox}><input name="active" type="checkbox" defaultChecked={editing.active} />{locale === "ar" ? "نشط" : "Active"}</label>
            <div className={styles.row}><button className={styles.button} type="submit" disabled={pending}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ" : "Save")}</button><button className={styles.buttonSecondary} type="button" onClick={() => setEditing(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button></div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function FormField({ name, label, value, type = "text", ...props }: { name: string; label: string; value: string; type?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue" | "type">) { return <div className={styles.field}><label htmlFor={`category-${name}`}>{label}</label><input id={`category-${name}`} className={styles.input} name={name} type={type} defaultValue={value} required {...props} /></div>; }
function TextField({ name, label, value, ...props }: { name: string; label: string; value: string } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue">) { return <div className={styles.field}><label htmlFor={`category-${name}`}>{label}</label><textarea id={`category-${name}`} className={styles.textarea} name={name} defaultValue={value} {...props} /></div>; }
