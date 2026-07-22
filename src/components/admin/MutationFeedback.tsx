"use client";

import { useEffect, useId, useState } from "react";
import { adminMessages } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/types";
import styles from "./admin.module.css";

type ApiResult<T = unknown> = { ok: true; data: T; message?: string } | { ok: false; error: string; fields?: Record<string, string[]> };

export function adminErrorText(locale: AdminLocale, value: string) {
  if (locale !== "ar") return value;
  const text = value.toLocaleLowerCase("en");
  if (text.includes("authentication")) return "يرجى تسجيل الدخول للمتابعة.";
  if (text.includes("permission")) return "ليست لديك صلاحية لإجراء هذه العملية.";
  if (text.includes("stock") || text.includes("inventory")) return "تعذر تحديث المخزون. تحقق من الكمية المتاحة والقيمة المدخلة.";
  if (text.includes("transition") || text.includes("cannot move")) return "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية.";
  if (text.includes("unique") || text.includes("already exists")) return "توجد قيمة مطابقة مستخدمة مسبقًا. تحقق من الرمز أو الرابط.";
  if (text.includes("not found") || text.includes("no longer exists")) return "لم يعد السجل المطلوب موجودًا. حدّث الصفحة وحاول مجددًا.";
  if (text.includes("too large") || text.includes("smaller than")) return "حجم الملف أو الطلب أكبر من الحد المسموح.";
  if (text.includes("image") || text.includes("jpeg") || text.includes("png")) return "تعذر قبول الصورة. استخدم JPG أو PNG أو WebP أو AVIF ضمن الحجم المسموح.";
  if (text.includes("highlighted fields") || text.includes("validation")) return "تحقق من الحقول المطلوبة والقيم المدخلة.";
  if (text.includes("referenced")) return "لا يمكن إزالة هذا السجل لأنه مرتبط ببيانات محفوظة.";
  return "تعذر إكمال الطلب. تحقق من البيانات وحاول مجددًا.";
}

export async function adminFetch<T = unknown>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
    });
    const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!response.ok) return payload && !payload.ok ? payload : { ok: false, error: "The server could not complete this request." };
    return payload ?? { ok: true, data: undefined as T };
  } catch {
    return { ok: false, error: "The server could not be reached. Check your connection and try again." };
  }
}

export function MutationMessage({ result, locale }: { result: ApiResult | null; locale: AdminLocale }) {
  const id = useId();
  if (!result) return <span id={id} className={styles.srOnly} aria-live="polite" />;
  return (
    <div id={id} role={result.ok ? "status" : "alert"} className={result.ok ? styles.successBanner : styles.errorBanner}>
      {result.ok ? (locale === "ar" ? "تم حفظ التغييرات بنجاح." : result.message || "Changes saved successfully.") : adminErrorText(locale, result.error)}
    </div>
  );
}

export function ConfirmAction({
  locale,
  label,
  confirmMessage,
  url,
  method = "DELETE",
  body,
  onSuccess,
  danger = false,
}: {
  locale: AdminLocale;
  label: string;
  confirmMessage: string;
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  onSuccess?: () => void;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const messages = adminMessages[locale];

  useEffect(() => {
    if (!result || result.ok) return;
    const timer = window.setTimeout(() => setResult(null), 6000);
    return () => window.clearTimeout(timer);
  }, [result]);

  async function run() {
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    setResult(null);
    const next = await adminFetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    setPending(false);
    setResult(next);
    if (next.ok) onSuccess?.();
  }

  return (
    <span>
      <button className={danger ? styles.buttonDanger : styles.buttonSecondary} type="button" disabled={pending} onClick={run}>
        {pending ? messages.saving : label}
      </button>
      {result && !result.ok ? <span className={styles.errorText} role="alert">{adminErrorText(locale, result.error)}</span> : null}
    </span>
  );
}

export type { ApiResult };
