"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { adminMessages } from "@/lib/admin/i18n";
import type { AdminCategory, AdminLocale, AdminProductDetail } from "@/lib/admin/types";
import { percentageFromSalePrice, salePriceFromPercentage } from "@/lib/domain/pricing";
import { adminErrorText, adminFetch, MutationMessage, type ApiResult } from "./MutationFeedback";
import styles from "./admin.module.css";
import { Tooltip } from "@/components/ui/tooltip";

type DraftImage = AdminProductDetail["images"][number];
type DraftVariant = AdminProductDetail["variants"][number];

const emptyProduct: AdminProductDetail = {
  id: "",
  sku: "",
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  price: 0,
  effectivePrice: 0,
  saleEnabled: false,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  saleUpdatedAt: null,
  saleStatus: "DISABLED",
  discountPercentage: 0,
  stock: 0,
  lowStockThreshold: 5,
  status: "ACTIVE",
  available: true,
  active: true,
  featured: false,
  variationCount: 0,
  archivedAt: null,
  categoryId: "",
  categoryNameAr: "",
  categoryNameEn: "",
  primaryImageUrl: null,
  updatedAt: new Date(0).toISOString(),
  images: [],
  variants: [],
};

export function ProductForm({ locale, product: suppliedProduct, categories, defaultLowStockThreshold = 5 }: { locale: AdminLocale; product?: AdminProductDetail; categories: AdminCategory[]; defaultLowStockThreshold?: number }) {
  const product = suppliedProduct ?? { ...emptyProduct, lowStockThreshold: defaultLowStockThreshold };
  const messages = adminMessages[locale];
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<DraftImage[]>(product.images);
  const [variants, setVariants] = useState<DraftVariant[]>(product.variants);
  const [normalPrice, setNormalPrice] = useState(product.price);
  const [saleEnabled, setSaleEnabled] = useState(product.saleEnabled);
  const [saleInputMethod, setSaleInputMethod] = useState<"PRICE" | "PERCENTAGE">("PRICE");
  const [salePrice, setSalePrice] = useState<number | null>(product.salePrice);
  const [salePercentage, setSalePercentage] = useState<number | null>(product.salePrice ? percentageFromSalePrice(product.price, product.salePrice) : null);
  const [saleStartsAt, setSaleStartsAt] = useState(toDatetimeLocal(product.saleStartsAt));
  const [saleEndsAt, setSaleEndsAt] = useState(toDatetimeLocal(product.saleEndsAt));
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const editing = Boolean(product.id);
  const title = locale === "ar" ? (editing ? "تعديل المنتج" : "إضافة منتج") : editing ? "Edit product" : "Create product";

  const normalizedImages = useMemo(() => images.map((image, index) => ({ ...image, position: index, primary: index === 0 })), [images]);
  const preview = useMemo(() => {
    if (!saleEnabled || normalPrice <= 0) return null;
    try {
      const resolvedSalePrice = saleInputMethod === "PERCENTAGE" ? Number(salePriceFromPercentage(normalPrice, salePercentage ?? 0)) : salePrice;
      if (resolvedSalePrice === null || resolvedSalePrice <= 0 || resolvedSalePrice >= normalPrice) return null;
      return { salePrice: resolvedSalePrice, percentage: percentageFromSalePrice(normalPrice, resolvedSalePrice) };
    } catch {
      return null;
    }
  }, [normalPrice, saleEnabled, saleInputMethod, salePercentage, salePrice]);

  function addVariant() {
    setVariants((current) => [...current, { sku: "", labelAr: "", labelEn: "", priceOverride: null, stock: 0, available: true, active: true }]);
  }

  function updateVariant(index: number, key: keyof DraftVariant, value: string | number | boolean | null) {
    setVariants((current) => current.map((variant, position) => position === index ? { ...variant, [key]: value } : variant));
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      const selected = copy[index];
      const replacement = copy[target];
      if (!selected || !replacement) return current;
      copy[index] = replacement;
      copy[target] = selected;
      return copy;
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setResult(null);
    const data = new FormData();
    data.set("file", file);
    const response = await adminFetch<{ storageKey: string; url: string; mimeType: DraftImage["mimeType"]; sizeBytes: number }>("/api/admin/uploads", { method: "POST", body: data });
    setUploading(false);
    if (!response.ok) return setResult(response);
    setImages((current) => [...current, { id: response.data.storageKey, storageKey: response.data.storageKey, url: response.data.url, mimeType: response.data.mimeType, sizeBytes: response.data.sizeBytes, altAr: "", altEn: "", position: current.length, primary: current.length === 0 }]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setResult(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const payload = {
      sku: String(form.get("sku") ?? ""),
      nameAr: String(form.get("nameAr") ?? ""),
      nameEn: String(form.get("nameEn") ?? ""),
      descriptionAr: String(form.get("descriptionAr") ?? ""),
      descriptionEn: String(form.get("descriptionEn") ?? ""),
      price: Number(form.get("price")),
      saleEnabled,
      saleInputMethod,
      salePrice: saleInputMethod === "PRICE" ? salePrice : null,
      salePercentage: saleInputMethod === "PERCENTAGE" ? salePercentage : null,
      saleStartsAt: saleEnabled && saleStartsAt ? new Date(saleStartsAt).toISOString() : null,
      saleEndsAt: saleEnabled && saleEndsAt ? new Date(saleEndsAt).toISOString() : null,
      stock: Number(form.get("stock")),
      lowStockThreshold: Number(form.get("lowStockThreshold")),
      categoryId: String(form.get("categoryId") ?? ""),
      available: form.get("available") === "on",
      active: form.get("active") === "on",
      featured: form.get("featured") === "on",
      images: normalizedImages.map(({ id, storageKey, url, mimeType, sizeBytes, altAr, altEn, position, primary }) => ({ id, storageKey, url, mimeType, sizeBytes, altAr, altEn, position, primary })),
      variants: variants.map(({ id, sku, labelAr, labelEn, priceOverride, stock, available, active }) => ({ id, sku, labelAr, labelEn, priceOverride, stock, available, active })),
    };
    const response = await adminFetch<{ id: string }>(editing ? `/api/admin/products/${product.id}` : "/api/admin/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
    setPending(false);
    setResult(response);
    if (!response.ok) {
      setFieldErrors(response.fields ?? {});
      const firstField = Object.keys(response.fields ?? {})[0]?.split(".")[0];
      if (firstField) window.requestAnimationFrame(() => formElement.querySelector<HTMLElement>(`[name="${CSS.escape(firstField)}"], #${CSS.escape(firstField)}`)?.focus());
      return;
    }
    router.push(`/${locale}/admin/products/${response.data.id}`);
    router.refresh();
  }

  const errorFor = (name: string) => { const error = fieldErrors[name]?.[0]; return error ? adminErrorText(locale, error) : undefined; };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <MutationMessage result={result} locale={locale} />
      <section className={styles.card} aria-labelledby="product-core-heading">
        <div className={styles.cardHeader}><div><h2 id="product-core-heading">{title}</h2><p>{locale === "ar" ? "أدخل المحتوى باللغتين. ستظهر اللغة البديلة تلقائيًا عند نقص الترجمة." : "Enter both languages. The alternate language is used as a safe fallback."}</p></div></div>
        <div className={styles.formGrid}>
          <Field name="nameAr" label="الاسم بالعربية" defaultValue={product.nameAr} required error={errorFor("nameAr")} dir="rtl" />
          <Field name="nameEn" label="English name" defaultValue={product.nameEn} required error={errorFor("nameEn")} dir="ltr" />
          <Field name="sku" label={locale === "ar" ? "رمز المخزون SKU" : "SKU"} defaultValue={product.sku} required error={errorFor("sku")} dir="ltr" />
          <div className={styles.field}>
            <label htmlFor="categoryId">{locale === "ar" ? "التصنيف" : "Category"}</label>
            <select id="categoryId" name="categoryId" className={styles.select} defaultValue={product.categoryId} required aria-invalid={Boolean(errorFor("categoryId"))} aria-describedby={errorFor("categoryId") ? "categoryId-error" : undefined}>
              <option value="">{locale === "ar" ? "اختر تصنيفًا" : "Select a category"}</option>
              {categories.filter((item) => item.active || item.id === product.categoryId).map((item) => <option value={item.id} key={item.id}>{locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}</option>)}
            </select>
            {errorFor("categoryId") ? <span id="categoryId-error" className={styles.errorText}>{errorFor("categoryId")}</span> : null}
          </div>
          <Field name="price" type="number" label={locale === "ar" ? "السعر العادي" : "Normal price"} defaultValue={String(product.price)} min="0.01" step="0.01" required error={errorFor("price")} onChange={(event: ChangeEvent<HTMLInputElement>) => setNormalPrice(Number(event.target.value))} />
          <Field name="stock" type="number" label={locale === "ar" ? "مخزون المنتج الأساسي" : "Base product stock"} defaultValue={String(product.stock)} min="0" step="1" required readOnly={editing} aria-describedby={editing ? "stock-edit-note" : undefined} error={errorFor("stock")} />
          <Field name="lowStockThreshold" type="number" label={locale === "ar" ? "حد انخفاض المخزون" : "Low-stock threshold"} defaultValue={String(product.lowStockThreshold)} min="0" step="1" required error={errorFor("lowStockThreshold")} />
        </div>
        {editing ? <p id="stock-edit-note" className={`${styles.infoBanner} ${styles.sectionGap}`}>{locale === "ar" ? "المخزون للقراءة فقط هنا. استخدم صفحة المخزون لكل زيادة أو تصحيح حتى يُحفظ السبب وسجل المسؤول ولا تُستبدل كميات الطلبات المتزامنة." : "Stock is read-only while editing product details. Use Inventory for every increase or correction so the reason and administrator are logged and concurrent order deductions cannot be overwritten."}</p> : null}
        <div className={`${styles.formGrid} ${styles.sectionGap}`}>
          <TextArea name="descriptionAr" label="الوصف بالعربية" defaultValue={product.descriptionAr} required error={errorFor("descriptionAr")} dir="rtl" />
          <TextArea name="descriptionEn" label="English description" defaultValue={product.descriptionEn} required error={errorFor("descriptionEn")} dir="ltr" />
        </div>
        <div className={`${styles.row} ${styles.sectionGap}`}>
          <label className={styles.checkbox}><input name="available" type="checkbox" defaultChecked={product.available} />{locale === "ar" ? "متاح للبيع" : "Available for sale"}</label>
          <label className={styles.checkbox}><input name="active" type="checkbox" defaultChecked={product.active} />{locale === "ar" ? "نشط وظاهر في المتجر" : "Active and visible in storefront"}</label>
          <label className={styles.checkbox}><input name="featured" type="checkbox" defaultChecked={product.featured} />{locale === "ar" ? "منتج مميز" : "Featured product"}</label>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="sale-heading">
        <div className={styles.cardHeader}>
          <div>
            <h2 id="sale-heading">{locale === "ar" ? "العرض والتخفيض" : "Sale and discount"}</h2>
            <p>{locale === "ar" ? "حدد سعراً مخفضاً أو نسبة خصم. يطبق نفس معدل الخصم على أسعار الخيارات تلقائياً." : "Set a sale price or a discount percentage. The same discount ratio is applied to variant prices automatically."}</p>
          </div>
          <label className={styles.checkbox}><input type="checkbox" checked={saleEnabled} onChange={(event) => setSaleEnabled(event.target.checked)} />{locale === "ar" ? "تفعيل العرض" : "Enable sale"}</label>
        </div>
        {saleEnabled ? <div className={styles.stack}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="saleInputMethod">{locale === "ar" ? "طريقة التخفيض" : "Discount input"}</label>
              <select id="saleInputMethod" className={styles.select} value={saleInputMethod} onChange={(event) => setSaleInputMethod(event.target.value as "PRICE" | "PERCENTAGE")}>
                <option value="PRICE">{locale === "ar" ? "سعر مخفض" : "Sale price"}</option>
                <option value="PERCENTAGE">{locale === "ar" ? "نسبة مئوية" : "Percentage"}</option>
              </select>
            </div>
            {saleInputMethod === "PRICE" ? <div className={styles.field}>
              <label htmlFor="salePrice">{locale === "ar" ? "السعر المخفض" : "Sale price"}</label>
              <input id="salePrice" name="salePrice" className={styles.input} type="number" min="0.01" step="0.01" required value={salePrice ?? ""} onChange={(event) => setSalePrice(event.target.value === "" ? null : Number(event.target.value))} aria-invalid={Boolean(errorFor("salePrice"))} aria-describedby={errorFor("salePrice") ? "salePrice-error" : undefined} />
              {errorFor("salePrice") ? <span id="salePrice-error" className={styles.errorText}>{errorFor("salePrice")}</span> : null}
            </div> : <div className={styles.field}>
              <label htmlFor="salePercentage">{locale === "ar" ? "نسبة الخصم %" : "Discount percentage %"}</label>
              <input id="salePercentage" name="salePercentage" className={styles.input} type="number" min="0.01" max="99.99" step="0.01" required value={salePercentage ?? ""} onChange={(event) => setSalePercentage(event.target.value === "" ? null : Number(event.target.value))} aria-invalid={Boolean(errorFor("salePercentage"))} aria-describedby={errorFor("salePercentage") ? "salePercentage-error" : undefined} />
              {errorFor("salePercentage") ? <span id="salePercentage-error" className={styles.errorText}>{errorFor("salePercentage")}</span> : null}
            </div>}
            <div className={styles.field}><label htmlFor="saleStartsAt">{locale === "ar" ? "يبدأ في (اختياري)" : "Starts at (optional)"}</label><input id="saleStartsAt" className={styles.input} type="datetime-local" value={saleStartsAt} onChange={(event) => setSaleStartsAt(event.target.value)} /></div>
            <div className={styles.field}><label htmlFor="saleEndsAt">{locale === "ar" ? "ينتهي في (اختياري)" : "Ends at (optional)"}</label><input id="saleEndsAt" className={styles.input} type="datetime-local" value={saleEndsAt} onChange={(event) => setSaleEndsAt(event.target.value)} aria-invalid={Boolean(errorFor("saleEndsAt"))} aria-describedby={errorFor("saleEndsAt") ? "saleEndsAt-error" : undefined} />{errorFor("saleEndsAt") ? <span id="saleEndsAt-error" className={styles.errorText}>{errorFor("saleEndsAt")}</span> : null}</div>
          </div>
          <div className={styles.infoBanner} role="status" aria-live="polite">
            {preview ? <>{locale === "ar" ? "المعاينة:" : "Preview:"} <del>{normalPrice.toFixed(2)}</del> <strong>{preview.salePrice.toFixed(2)}</strong> · {preview.percentage}% {locale === "ar" ? "خصم" : "off"}</> : (locale === "ar" ? "أدخل تخفيضاً صالحاً أقل من السعر العادي لمعاينته." : "Enter a valid discount below the normal price to preview it.")}
            {editing ? <small className={styles.muted}>{locale === "ar" ? "حالة العرض الحالية: " : "Current sale status: "}<strong>{product.saleStatus}</strong></small> : null}
            {editing && product.saleUpdatedAt ? <small className={styles.muted}>{locale === "ar" ? " آخر تحديث للعرض: " : " Sale last updated: "}{new Intl.DateTimeFormat(locale === "ar" ? "ar-PS" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(product.saleUpdatedAt))}</small> : null}
          </div>
        </div> : <p className={styles.infoBanner}>{locale === "ar" ? "السعر العادي هو السعر الفعّال حالياً. فعّل العرض لإضافة تخفيض." : "The normal price is currently effective. Enable the sale to add a discount."}</p>}
      </section>

      <section className={styles.card} aria-labelledby="images-heading">
        <div className={styles.cardHeader}>
          <div><h2 id="images-heading">{locale === "ar" ? "صور المنتج" : "Product images"}</h2><p>{locale === "ar" ? "الصورة الأولى هي الصورة الأساسية. JPG أو PNG أو WebP أو AVIF، بحد أقصى 5 ميجابايت." : "The first image is primary. JPG, PNG, WebP, or AVIF, up to 5 MB."}</p></div>
          <label className={styles.buttonSecondary}>
            <ImagePlus size={17} aria-hidden="true" />{uploading ? (locale === "ar" ? "جارٍ الرفع…" : "Uploading…") : (locale === "ar" ? "رفع صورة" : "Upload image")}
            <input ref={fileInput} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} />
          </label>
        </div>
        {images.length === 0 ? <div className={styles.emptyState}><p>{locale === "ar" ? "لم تُرفع صور بعد. أضف صورة واضحة بخلفية محايدة." : "No images uploaded. Add a clear product image on a neutral background."}</p></div> : (
          <div className={styles.stack}>
            {normalizedImages.map((image, index) => (
              <div className={styles.card} key={`${image.id}-${index}`}>
                <div className={styles.row}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin previews include local replaceable upload URLs */}
                  <img className={styles.thumb} src={image.url} alt="" />
                  <strong>{index === 0 ? (locale === "ar" ? "الصورة الأساسية" : "Primary image") : `${locale === "ar" ? "صورة" : "Image"} ${index + 1}`}</strong>
                  <div className={styles.tableActions}>
                    <Tooltip label={locale === "ar" ? "تحريك الصورة لأعلى" : "Move image up"}><button className={`${styles.buttonSecondary} ${styles.iconButton}`} type="button" disabled={index === 0} aria-label={locale === "ar" ? "تحريك الصورة لأعلى" : "Move image up"} onClick={() => moveImage(index, -1)}><ArrowUp size={16} /></button></Tooltip>
                    <Tooltip label={locale === "ar" ? "تحريك الصورة لأسفل" : "Move image down"}><button className={`${styles.buttonSecondary} ${styles.iconButton}`} type="button" disabled={index === images.length - 1} aria-label={locale === "ar" ? "تحريك الصورة لأسفل" : "Move image down"} onClick={() => moveImage(index, 1)}><ArrowDown size={16} /></button></Tooltip>
                    <Tooltip label={locale === "ar" ? "إزالة الصورة" : "Remove image"}><button className={`${styles.buttonDanger} ${styles.iconButton}`} type="button" aria-label={locale === "ar" ? "إزالة الصورة" : "Remove image"} onClick={() => setImages((current) => current.filter((_, position) => position !== index))}><Trash2 size={16} /></button></Tooltip>
                  </div>
                </div>
                <div className={`${styles.formGrid} ${styles.sectionGap}`}>
                  <div className={styles.field}><label htmlFor={`image-alt-ar-${index}`}>النص البديل بالعربية</label><input id={`image-alt-ar-${index}`} className={styles.input} dir="rtl" value={image.altAr} onChange={(event) => setImages((current) => current.map((item, position) => position === index ? { ...item, altAr: event.target.value } : item))} /></div>
                  <div className={styles.field}><label htmlFor={`image-alt-en-${index}`}>English alt text</label><input id={`image-alt-en-${index}`} className={styles.input} dir="ltr" value={image.altEn} onChange={(event) => setImages((current) => current.map((item, position) => position === index ? { ...item, altEn: event.target.value } : item))} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="variants-heading">
        <div className={styles.cardHeader}>
          <div><h2 id="variants-heading">{locale === "ar" ? "خيارات المنتج" : "Product variants"}</h2><p>{locale === "ar" ? "أضف الحجم أو اللون أو الرائحة أو الموديل عند الحاجة. المخزون مستقل لكل خيار." : "Add size, color, scent, or model when needed. Each variant has independent stock."}</p></div>
          <button className={styles.buttonSecondary} type="button" onClick={addVariant}><Plus size={17} aria-hidden="true" />{locale === "ar" ? "إضافة خيار" : "Add variant"}</button>
        </div>
        {variants.length === 0 ? <div className={styles.emptyState}><p>{locale === "ar" ? "هذا المنتج لا يحتوي على خيارات." : "This product has no variants."}</p></div> : (
          <div className={styles.stack}>
            {variants.map((variant, index) => (
              <fieldset className={styles.card} key={variant.id ?? `new-${index}`}>
                <legend className={styles.label}>{locale === "ar" ? `الخيار ${index + 1}` : `Variant ${index + 1}`}</legend>
                <div className={styles.formGrid}>
                  <div className={styles.field}><label htmlFor={`variant-ar-${index}`}>التسمية بالعربية</label><input id={`variant-ar-${index}`} className={styles.input} dir="rtl" required value={variant.labelAr} onChange={(event) => updateVariant(index, "labelAr", event.target.value)} /></div>
                  <div className={styles.field}><label htmlFor={`variant-en-${index}`}>English label</label><input id={`variant-en-${index}`} className={styles.input} dir="ltr" required value={variant.labelEn} onChange={(event) => updateVariant(index, "labelEn", event.target.value)} /></div>
                  <div className={styles.field}><label htmlFor={`variant-sku-${index}`}>SKU</label><input id={`variant-sku-${index}`} className={styles.input} dir="ltr" required value={variant.sku} onChange={(event) => updateVariant(index, "sku", event.target.value)} /></div>
                  <div className={styles.field}><label htmlFor={`variant-price-${index}`}>{locale === "ar" ? "سعر بديل (اختياري)" : "Price override (optional)"}</label><input id={`variant-price-${index}`} className={styles.input} type="number" min="0" step="0.01" value={variant.priceOverride ?? ""} onChange={(event) => updateVariant(index, "priceOverride", event.target.value === "" ? null : Number(event.target.value))} /></div>
                  <div className={styles.field}><label htmlFor={`variant-stock-${index}`}>{locale === "ar" ? "المخزون" : "Stock"}</label><input id={`variant-stock-${index}`} className={styles.input} type="number" min="0" step="1" required readOnly={editing && Boolean(variant.id)} aria-describedby={editing && variant.id ? "stock-edit-note" : undefined} value={variant.stock} onChange={(event) => updateVariant(index, "stock", Number(event.target.value))} /></div>
                  <label className={styles.checkbox}><input type="checkbox" checked={variant.available} onChange={(event) => updateVariant(index, "available", event.target.checked)} />{locale === "ar" ? "متاح للبيع" : "Available"}</label>
                  <label className={styles.checkbox}><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(index, "active", event.target.checked)} />{locale === "ar" ? "نشط" : "Active"}</label>
                </div>
                <button className={`${styles.buttonDanger} ${styles.sectionGap}`} type="button" onClick={() => setVariants((current) => current.filter((_, position) => position !== index))}><Trash2 size={16} />{locale === "ar" ? "إزالة الخيار" : "Remove variant"}</button>
              </fieldset>
            ))}
          </div>
        )}
      </section>

      <div className={styles.formActions}>
        <button className={styles.buttonSecondary} type="button" onClick={() => router.push(`/${locale}/admin/products`)}>{messages.cancel}</button>
        <button className={styles.button} type="submit" disabled={pending || uploading}>{pending ? messages.saving : messages.save}</button>
      </div>
    </form>
  );
}

function Field({ name, label, defaultValue, type = "text", error, ...props }: { name: string; label: string; defaultValue: string; type?: string; error?: string; [key: string]: unknown }) {
  const errorId = `${name}-error`;
  const describedBy = typeof props["aria-describedby"] === "string" ? props["aria-describedby"] : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} className={styles.input} type={type} defaultValue={defaultValue} {...props} aria-invalid={Boolean(error)} aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined} />
      {error ? <span id={errorId} className={styles.errorText}>{error}</span> : null}
    </div>
  );
}

function TextArea({ name, label, defaultValue, error, ...props }: { name: string; label: string; defaultValue: string; error?: string; [key: string]: unknown }) {
  const errorId = `${name}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} className={styles.textarea} defaultValue={defaultValue} {...props} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
      {error ? <span id={errorId} className={styles.errorText}>{error}</span> : null}
    </div>
  );
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
