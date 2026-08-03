"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AdminContentPage, AdminLocale } from "@/lib/admin/types";
import { adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import styles from "./admin.module.css";

const labels: Record<string, readonly [string, string]> = {
  TERMS: ["الشروط والأحكام", "Terms & conditions"],
  PRIVACY: ["سياسة الخصوصية", "Privacy policy"],
  NO_RETURN: ["سياسة عدم الإرجاع", "No-return policy"],
  WARRANTY: ["سياسة الضمان", "Warranty policy"],
  DELIVERY: ["معلومات التوصيل", "Delivery information"],
  PICKUP: ["معلومات الاستلام", "Pickup information"],
};

export function ContentManager({ locale, pages }: { locale: AdminLocale; pages: AdminContentPage[] }) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState(pages[0]?.key ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = pages.find((page) => page.key === selectedKey) ?? pages[0];
  if (!selected) return null;

  function selectTab(index: number) {
    const next = pages[index];
    if (!next) return;
    setSelectedKey(next.key);
    setResult(null);
    tabRefs.current[index]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = locale === "ar" ? -1 : 1;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + direction + pages.length) % pages.length;
    if (event.key === "ArrowLeft") nextIndex = (index - direction + pages.length) % pages.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = pages.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    const response = await adminFetch("/api/admin/content", {
      method: "PATCH",
      body: JSON.stringify({
        type: selected.key,
        slug: form.get("slug"),
        titleAr: form.get("titleAr"),
        titleEn: form.get("titleEn"),
        bodyAr: form.get("bodyAr"),
        bodyEn: form.get("bodyEn"),
        active: form.get("active") === "on",
      }),
    });
    setPending(false);
    setResult(response);
    if (response.ok) router.refresh();
  }

  const panelId = `content-panel-${selected.key.toLowerCase()}`;
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label={locale === "ar" ? "صفحات المحتوى" : "Content pages"}>
        {pages.map((page, index) => {
          const active = page.key === selected.key;
          const tabId = `content-tab-${page.key.toLowerCase()}`;
          return (
            <button
              ref={(node) => { tabRefs.current[index] = node; }}
              id={tabId}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`content-panel-${page.key.toLowerCase()}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              key={page.key}
            >
              {locale === "ar" ? labels[page.key]?.[0] : labels[page.key]?.[1]}
            </button>
          );
        })}
      </div>
      <MutationMessage result={result} locale={locale} />
      <form
        id={panelId}
        role="tabpanel"
        aria-labelledby={`content-tab-${selected.key.toLowerCase()}`}
        tabIndex={0}
        className={`${styles.form} ${styles.tabPanel}`}
        onSubmit={submit}
        key={selected.key}
      >
        <section className={styles.card}>
          <div className={styles.cardHeader}><div><h2>{locale === "ar" ? labels[selected.key]?.[0] : labels[selected.key]?.[1]}</h2><p>{locale === "ar" ? "آخر تحديث" : "Last updated"}: {new Intl.DateTimeFormat(locale === "ar" ? "ar-PS" : "en-PS").format(new Date(selected.updatedAt))}</p></div></div>
          <div className={styles.formGrid}>
            <Field name="titleAr" label="العنوان بالعربية" value={selected.titleAr} dir="rtl" />
            <Field name="titleEn" label="English title" value={selected.titleEn} dir="ltr" />
            <div className={styles.field}>
              <label htmlFor="content-slug">{locale === "ar" ? "الرابط المختصر" : "URL slug"}</label>
              <input id="content-slug" name="slug" className={styles.input} defaultValue={selected.slug} dir="ltr" readOnly aria-describedby="content-slug-help" />
              <span id="content-slug-help" className={styles.helpText}>{locale === "ar" ? "مسار هذه الصفحة ثابت لضمان عمل روابط المتجر." : "This page route is fixed so storefront links remain valid."}</span>
            </div>
          </div>
          <div className={`${styles.formGrid} ${styles.sectionGap}`}>
            <div className={styles.field}><label htmlFor="content-body-ar">المحتوى بالعربية</label><textarea id="content-body-ar" className={styles.textarea} name="bodyAr" defaultValue={selected.bodyAr} dir="rtl" required rows={12} /></div>
            <div className={styles.field}><label htmlFor="content-body-en">English content</label><textarea id="content-body-en" className={styles.textarea} name="bodyEn" defaultValue={selected.bodyEn} dir="ltr" required rows={12} /></div>
          </div>
          <label className={styles.checkbox}><input name="active" type="checkbox" defaultChecked={selected.active} />{locale === "ar" ? "منشور" : "Published"}</label>
        </section>
        <div className={styles.formActions}><button className={styles.button} type="submit" disabled={pending}>{pending ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ المحتوى" : "Save content")}</button></div>
      </form>
    </>
  );
}

function Field({ name, label, value, ...props }: { name: string; label: string; value: string; [key: string]: string }) {
  return <div className={styles.field}><label htmlFor={`content-${name}`}>{label}</label><input id={`content-${name}`} name={name} className={styles.input} defaultValue={value} required {...props} /></div>;
}
