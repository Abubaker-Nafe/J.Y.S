"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminCity, AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import { StatusBadge } from "./AdminUi";
import styles from "./admin.module.css";

type Draft =
  | { kind: "city"; id: string; nameAr: string; nameEn: string; slug: string; active: boolean; displayOrder: number }
  | { kind: "area"; id: string; cityId: string; nameAr: string; nameEn: string; slug: string; active: boolean; displayOrder: number };

export function LocationManager({ locale, cities }: { locale: AdminLocale; cities: AdminCity[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  function newCity() { setResult(null); setDraft({ kind: "city", id: "", nameAr: "", nameEn: "", slug: "", active: true, displayOrder: cities.length }); }
  function newArea(city: AdminCity) { setResult(null); setDraft({ kind: "area", id: "", cityId: city.id, nameAr: "", nameEn: "", slug: "", active: true, displayOrder: city.areas.length }); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    try {
      const payload = { kind: draft.kind, ...(draft.kind === "area" ? { cityId: draft.cityId } : {}), nameAr: form.get("nameAr"), nameEn: form.get("nameEn"), slug: form.get("slug"), active: form.get("active") === "on", displayOrder: Number(form.get("displayOrder")) };
      const response = await adminFetch(draft.id ? `/api/admin/locations/${draft.id}` : "/api/admin/locations", { method: draft.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setResult(response);
      if (response.ok) { setDraft(null); router.refresh(); }
    } finally {
      setPending(false);
    }
  }

  return <><div className={styles.rowBetween}><p className={styles.helpText}>{locale === "ar" ? "أدر المدن والمناطق المستخدمة لجمع عناوين التوصيل وترتيب ظهورها." : "Manage the cities and areas used to collect delivery addresses and their display order."}</p><button className={styles.button} type="button" onClick={newCity}><Plus size={17} />{locale === "ar" ? "إضافة مدينة" : "Add city"}</button></div><MutationMessage result={result} locale={locale} />
    <div className={`${styles.stack} ${styles.sectionGap}`}>{cities.length ? cities.map((city) => <section className={styles.card} key={city.id}><div className={styles.cardHeader}><div><h2>{locale === "ar" ? city.nameAr || city.nameEn : city.nameEn || city.nameAr}</h2><p>/{city.slug}</p></div><div className={styles.row}><StatusBadge label={city.active ? (locale === "ar" ? "نشطة" : "Active") : (locale === "ar" ? "متوقفة" : "Inactive")} tone={city.active ? "success" : "default"} /><button className={styles.buttonSecondary} type="button" onClick={() => setDraft({ kind: "city", id: city.id, nameAr: city.nameAr, nameEn: city.nameEn, slug: city.slug, active: city.active, displayOrder: city.displayOrder })}>{locale === "ar" ? "تعديل المدينة" : "Edit city"}</button><button className={styles.buttonSecondary} type="button" onClick={() => newArea(city)}><Plus size={16} />{locale === "ar" ? "منطقة" : "Area"}</button></div></div>
      <div className={styles.tableWrap}>{city.areas.length ? <table className={styles.table}><thead><tr><th>{locale === "ar" ? "المنطقة" : "Area"}</th><th>{locale === "ar" ? "الرابط" : "Slug"}</th><th>{locale === "ar" ? "الترتيب" : "Order"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "الإجراء" : "Action"}</th></tr></thead><tbody>{city.areas.map((area) => <tr key={area.id}><td className={styles.primaryCell}>{locale === "ar" ? area.nameAr || area.nameEn : area.nameEn || area.nameAr}</td><td dir="ltr">/{area.slug}</td><td>{area.displayOrder}</td><td><StatusBadge label={area.active ? (locale === "ar" ? "نشطة" : "Active") : (locale === "ar" ? "متوقفة" : "Inactive")} tone={area.active ? "success" : "default"} /></td><td><button className={styles.buttonSecondary} type="button" onClick={() => setDraft({ kind: "area", id: area.id, cityId: city.id, nameAr: area.nameAr, nameEn: area.nameEn, slug: area.slug, active: area.active, displayOrder: area.displayOrder })}>{locale === "ar" ? "تعديل" : "Edit"}</button></td></tr>)}</tbody></table> : <div className={styles.emptyState}><p>{locale === "ar" ? "لا توجد مناطق لهذه المدينة." : "No areas are configured for this city."}</p></div>}</div>
    </section>) : <div className={styles.emptyState}><p>{locale === "ar" ? "أضف أول مدينة لبدء إعداد عناوين التوصيل." : "Add the first city to configure delivery addresses."}</p></div>}</div>
    {draft ? <section className={`${styles.card} ${styles.sectionGap}`} aria-labelledby="location-form-heading"><div className={styles.cardHeader}><div><h2 id="location-form-heading">{draft.kind === "city" ? (locale === "ar" ? "بيانات المدينة" : "City details") : (locale === "ar" ? "بيانات المنطقة" : "Area details")}</h2></div></div><form className={styles.form} onSubmit={submit}><div className={styles.formGrid}><Field name="nameAr" label="الاسم بالعربية" value={draft.nameAr} dir="rtl" /><Field name="nameEn" label="English name" value={draft.nameEn} dir="ltr" /><Field name="slug" label={locale === "ar" ? "الرابط المختصر" : "Slug"} value={draft.slug} dir="ltr" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /><Field name="displayOrder" label={locale === "ar" ? "ترتيب العرض" : "Display order"} value={String(draft.displayOrder)} type="number" min="0" step="1" /></div><label className={styles.checkbox}><input name="active" type="checkbox" defaultChecked={draft.active} />{locale === "ar" ? "نشطة ومتاحة في العنوان" : "Active and available for addressing"}</label><div className={styles.row}><button className={styles.button} type="submit" disabled={pending}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ" : "Save")}</button><button className={styles.buttonSecondary} type="button" disabled={pending} onClick={() => setDraft(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button></div></form></section> : null}
  </>;
}

function Field({ name, label, value, ...props }: { name: string; label: string; value: string; [key: string]: string }) {
  return <div className={styles.field}><label htmlFor={`location-${name}`}>{label}</label><input id={`location-${name}`} className={styles.input} name={name} defaultValue={value} required {...props} /></div>;
}
