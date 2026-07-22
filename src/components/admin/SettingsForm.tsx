"use client";

import { ImagePlus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import styles from "./admin.module.css";

export type AdminSettingsValues = {
  profile: { nameAr: string; nameEn: string; phone: string; email: string };
  location: { addressAr: string; addressEn: string; mapUrl: string };
  hours: { ar: string; en: string };
  currency: { code: string; symbolAr: string; symbolEn: string };
  lowStock: number;
  promotion: { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; imageUrl: string };
};

export function SettingsForm({ locale, values }: { locale: AdminLocale; values: AdminSettingsValues }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [uploading, setUploading] = useState(false); const [result, setResult] = useState<ApiResult | null>(null); const [promotionImage, setPromotionImage] = useState(values.promotion.imageUrl);
  async function upload(file: File) { const data = new FormData(); data.set("file", file); setUploading(true); setResult(null); const response = await adminFetch<{ url: string }>("/api/admin/uploads", { method: "POST", body: data }); setUploading(false); if (response.ok) setPromotionImage(response.data.url); else setResult(response); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setResult(null);
    const settings = [
      { key: "store.profile", value: { nameAr: form.get("storeNameAr"), nameEn: form.get("storeNameEn"), phone: form.get("phone"), email: form.get("email") }, description: "Store identity and contacts", isPublic: true },
      { key: "store.location", value: { addressAr: form.get("addressAr"), addressEn: form.get("addressEn"), mapUrl: form.get("mapUrl") }, description: "Pickup location", isPublic: true },
      { key: "store.openingHours", value: { ar: form.get("hoursAr"), en: form.get("hoursEn") }, description: "Pickup opening hours", isPublic: true },
      { key: "commerce.currency", value: { code: String(form.get("currency")).toUpperCase(), symbolAr: form.get("symbolAr"), symbolEn: form.get("symbolEn") }, description: "Configured store currency", isPublic: true },
      { key: "inventory.defaultLowStockThreshold", value: Number(form.get("lowStock")), description: "Default low-stock warning", isPublic: false },
      { key: "homepage.promotion", value: { titleAr: form.get("promoTitleAr"), titleEn: form.get("promoTitleEn"), bodyAr: form.get("promoBodyAr"), bodyEn: form.get("promoBodyEn"), imageUrl: promotionImage }, description: "Homepage hero", isPublic: true },
    ];
    const response = await adminFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ settings }) }); setPending(false); setResult(response); if (response.ok) router.refresh();
  }
  return <form className={styles.form} onSubmit={submit}><MutationMessage result={result} locale={locale} />
    <section className={styles.card}><div className={styles.cardHeader}><div><h2>{locale === "ar" ? "هوية المتجر والتواصل" : "Store identity & contact"}</h2><p>{locale === "ar" ? "تظهر هذه المعلومات للعملاء في الترويسة والتواصل والاستلام." : "Shown to customers in store identity, contact, and pickup details."}</p></div></div><div className={styles.formGrid}><Field name="storeNameAr" label="اسم المتجر بالعربية" value={values.profile.nameAr} dir="rtl" /><Field name="storeNameEn" label="English store name" value={values.profile.nameEn} dir="ltr" /><Field name="phone" label={locale === "ar" ? "رقم الهاتف" : "Phone"} value={values.profile.phone} dir="ltr" type="tel" /><Field name="email" label={locale === "ar" ? "بريد التواصل" : "Contact email"} value={values.profile.email} dir="ltr" type="email" /></div></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><h2>{locale === "ar" ? "موقع الاستلام وساعات العمل" : "Pickup location & opening hours"}</h2></div></div><div className={styles.formGrid}><Field name="addressAr" label="العنوان بالعربية" value={values.location.addressAr} dir="rtl" /><Field name="addressEn" label="English address" value={values.location.addressEn} dir="ltr" /><Field name="hoursAr" label="ساعات الدوام بالعربية" value={values.hours.ar} dir="rtl" /><Field name="hoursEn" label="English opening hours" value={values.hours.en} dir="ltr" /><Field name="mapUrl" label={locale === "ar" ? "رابط الخريطة (اختياري)" : "Map URL (optional)"} value={values.location.mapUrl} dir="ltr" type="url" required={false} /></div></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><h2>{locale === "ar" ? "العملة وتنبيه المخزون" : "Currency & inventory defaults"}</h2><p>{locale === "ar" ? "لا يحول النظام العملات. يحدد رمز ISO العملة ورمزها المعروض للطلبات الجديدة، وتحتفظ الطلبات السابقة بعملتها الأصلية." : "The system does not convert currencies. The ISO code determines the displayed currency and symbol for new orders; historical orders keep their original currency."}</p></div></div><div className={styles.formGrid}><Field name="currency" label={locale === "ar" ? "رمز العملة ISO" : "ISO currency code"} value={values.currency.code} dir="ltr" pattern="[A-Za-z]{3}" maxLength={3} /><Field name="symbolAr" label={locale === "ar" ? "رمز مرجعي قديم (غير مستخدم في العرض)" : "Legacy reference symbol (not used for display)"} value={values.currency.symbolAr} dir="rtl" readOnly aria-describedby="currency-symbol-note" /><Field name="symbolEn" label={locale === "ar" ? "الرمز الإنجليزي المرجعي (غير مستخدم في العرض)" : "Legacy English symbol (not used for display)"} value={values.currency.symbolEn} dir="ltr" readOnly aria-describedby="currency-symbol-note" /><Field name="lowStock" label={locale === "ar" ? "حد انخفاض المخزون الافتراضي" : "Default low-stock threshold"} value={String(values.lowStock)} type="number" min="0" step="1" /></div><p id="currency-symbol-note" className={`${styles.helpText} ${styles.sectionGap}`}>{locale === "ar" ? "يشتق المتجر الرمز تلقائياً من رمز ISO. تُحفظ القيم المرجعية القديمة للتوافق مع البيانات الحالية فقط." : "The storefront derives its symbol from the ISO code. Legacy reference values are retained only for compatibility with existing data."}</p></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><h2>{locale === "ar" ? "ترويج الصفحة الرئيسية" : "Homepage promotion"}</h2></div><label className={styles.buttonSecondary}><ImagePlus size={17} />{uploading ? (locale === "ar" ? "جارٍ الرفع…" : "Uploading…") : (locale === "ar" ? "رفع صورة" : "Upload image")}<input className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label></div><div className={styles.formGrid}><Field name="promoTitleAr" label="العنوان بالعربية" value={values.promotion.titleAr} dir="rtl" /><Field name="promoTitleEn" label="English heading" value={values.promotion.titleEn} dir="ltr" /><TextField name="promoBodyAr" label="النص بالعربية" value={values.promotion.bodyAr} dir="rtl" /><TextField name="promoBodyEn" label="English text" value={values.promotion.bodyEn} dir="ltr" /></div>{promotionImage ? <div className={`${styles.row} ${styles.sectionGap}`}><Image className={styles.thumb} src={promotionImage} alt="" width={45} height={45} unoptimized /><code dir="ltr">{promotionImage}</code><button className={styles.buttonDanger} type="button" onClick={() => setPromotionImage("")}>{locale === "ar" ? "إزالة" : "Remove"}</button></div> : <p className={styles.helpText}>{locale === "ar" ? "لا توجد صورة ترويجية." : "No promotion image selected."}</p>}</section>
    <div className={styles.formActions}><button className={styles.button} type="submit" disabled={pending || uploading}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ الإعدادات" : "Save settings")}</button></div>
  </form>;
}

function Field({ name, label, value, required = true, ...props }: { name: string; label: string; value: string; required?: boolean; [key: string]: string | number | boolean | undefined }) { return <div className={styles.field}><label htmlFor={`setting-${name}`}>{label}</label><input id={`setting-${name}`} name={name} className={styles.input} defaultValue={value} required={required} {...props} /></div>; }
function TextField({ name, label, value, ...props }: { name: string; label: string; value: string; [key: string]: string }) { return <div className={styles.field}><label htmlFor={`setting-${name}`}>{label}</label><textarea id={`setting-${name}`} name={name} className={styles.textarea} defaultValue={value} required {...props} /></div>; }
