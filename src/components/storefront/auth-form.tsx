"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { StorefrontLocations } from "@/lib/catalog/locations";
import { translate } from "@/lib/i18n/dictionaries";
import { postAuthDestination } from "@/lib/auth/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { useStore, type StoreUser } from "./store-provider";

export type AuthMode = "login" | "register" | "forgot" | "reset";
type Errors = Record<string, string>;
type Feedback = { tone: "success" | "error"; text: string } | null;
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPhone = (phone: string) => /^(?:\+?970|00970|0)?5[69]\d{7}$/.test(phone.replace(/[\s-]/g, ""));
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function passwordError(password: string, mode: AuthMode, locale: Locale): string | undefined {
  if (mode === "login") {
    if (password.length === 0) return locale === "ar" ? "أدخل كلمة المرور." : "Enter your password.";
    if (password.length > 128) return locale === "ar" ? "كلمة المرور طويلة جداً." : "Password is too long.";
    return undefined;
  }
  const valid = password.length >= 10 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  if (valid) return undefined;
  return locale === "ar"
    ? "استخدم 10 أحرف على الأقل تتضمن حرفاً إنجليزياً كبيراً وصغيراً ورقماً."
    : "Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.";
}

function localizeServerIssue(message: string, locale: Locale): string {
  if (locale === "en") return message;
  const messages: Record<string, string> = {
    "Email is required": "البريد الإلكتروني مطلوب.",
    "Enter a valid email address": "أدخل بريداً إلكترونياً صالحاً.",
    "Phone number is required": "رقم الهاتف مطلوب.",
    "Enter a valid Palestinian mobile number": "أدخل رقم جوال فلسطيني صالحاً.",
    "Password must be at least 10 characters": "يجب أن تتكون كلمة المرور من 10 أحرف على الأقل.",
    "Password is too long": "كلمة المرور طويلة جداً.",
    "Password must include a lowercase letter": "يجب أن تتضمن كلمة المرور حرفاً إنجليزياً صغيراً.",
    "Password must include an uppercase letter": "يجب أن تتضمن كلمة المرور حرفاً إنجليزياً كبيراً.",
    "Password must include a number": "يجب أن تتضمن كلمة المرور رقماً.",
  };
  return messages[message] ?? message;
}

function authErrorText(code: string | undefined, message: string | undefined, locale: Locale): string {
  if (locale === "en") return message ?? "Check your details and try again.";
  const byCode: Record<string, string> = {
    INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    RATE_LIMITED: "عدد المحاولات كبير. حاول مرة أخرى لاحقاً.",
    AUTHENTICATION_REQUIRED: "سجّل الدخول للمتابعة.",
    FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء.",
    CONFLICT: "توجد بيانات مطابقة مسجلة مسبقاً.",
    INTERNAL_ERROR: "حدث خطأ غير متوقع. حاول مرة أخرى.",
  };
  const byMessage: Record<string, string> = {
    "An account with this email or phone already exists": "يوجد حساب مسجل بهذا البريد الإلكتروني أو رقم الهاتف.",
    "Selected city is unavailable": "المدينة المختارة غير متاحة.",
    "Selected area is unavailable": "المنطقة المختارة غير متاحة.",
    "This password-reset link is invalid or has expired": "رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته.",
  };
  return (code ? byCode[code] : undefined) ?? (message ? byMessage[message] : undefined) ?? "تحقق من البيانات وحاول مجدداً.";
}

export function AuthForm({ locale, mode, token, nextPath, locations }: { locale: Locale; mode: AuthMode; token?: string; nextPath?: string; locations?: StorefrontLocations }) {
  const router = useRouter(); const { setSessionUser, refreshSession } = useStore();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const [pending, setPending] = useState(false); const [errors, setErrors] = useState<Errors>({}); const [feedback, setFeedback] = useState<Feedback>(null); const [showPassword, setShowPassword] = useState(false);
  const [cityId, setCityId] = useState(locations?.cities[0]?.id ?? ""); const [areaId, setAreaId] = useState("");
  const city = locations?.cities.find((item) => item.id === cityId); const registrationUnavailable = mode === "register" && (!locations || locations.source === "unavailable" || locations.cities.length === 0);
  const t = (key: string) => translate(locale, key);
  const titles = { login: ["auth.login", "auth.loginText"], register: ["auth.register", "auth.registerText"], forgot: ["auth.forgot", "auth.forgotText"], reset: ["auth.reset", "auth.resetText"] } as const;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const focusField = (name: string) => window.requestAnimationFrame(() => (formElement.elements.namedItem(name) as HTMLElement | null)?.focus()); setErrors({}); setFeedback(null); const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim().toLowerCase(); const password = String(form.get("password") ?? ""); const nextErrors: Errors = {};
    if (mode !== "reset" && !validEmail(email)) nextErrors.email = locale === "ar" ? "أدخل بريداً إلكترونياً صالحاً." : "Enter a valid email address.";
    if (["login", "register", "reset"].includes(mode)) {
      const policyError = passwordError(password, mode, locale);
      if (policyError) nextErrors.password = policyError;
    }
    if (mode === "register") {
      const name = String(form.get("name") ?? "").trim(); const phone = String(form.get("phone") ?? ""); const address = String(form.get("addressLine") ?? "").trim();
      if (name.length < 2) nextErrors.name = locale === "ar" ? "أدخل الاسم الكامل." : "Enter your full name.";
      if (!validPhone(phone)) nextErrors.phone = locale === "ar" ? "أدخل رقم جوال فلسطيني صالحاً." : "Enter a valid Palestinian mobile number.";
      if (!cityId) nextErrors.cityId = locale === "ar" ? "اختر مدينة متاحة." : "Choose an available city.";
      if (address.length < 5) nextErrors.addressLine = locale === "ar" ? "أدخل عنواناً أوضح." : "Enter a more complete address.";
      if (password !== String(form.get("confirmPassword") ?? "")) nextErrors.confirmPassword = locale === "ar" ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.";
    }
    if (mode === "reset" && password !== String(form.get("confirmPassword") ?? "")) nextErrors.confirmPassword = locale === "ar" ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.";
    if (Object.keys(nextErrors).length || registrationUnavailable) { setErrors(nextErrors); const firstError = Object.keys(nextErrors)[0]; if (firstError) focusField(firstError); return; }
    setPending(true); const endpoint = `/api/auth/${mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : mode}`; let body: Record<string, unknown> = { email, password };
    if (mode === "register") { body = { name: String(form.get("name")), email, phone: String(form.get("phone")), password, cityId, areaId: areaId || undefined, addressLine: String(form.get("addressLine")), preferredLocale: locale }; }
    if (mode === "forgot") body = { email }; if (mode === "reset") body = { token: token ?? "", password };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.ok) {
        if (mode === "forgot") { setFeedback({ tone: "success", text: t("auth.sent") }); event.currentTarget.reset(); return; }
        if (mode === "reset") { router.push(`/${locale}/login?reset=1`); return; }
        const payload = await response.json() as { user?: StoreUser }; if (!payload.user) throw new Error(locale === "ar" ? "استجابة الحساب غير مكتملة." : "The account response was incomplete.");
        setSessionUser(payload.user); await refreshSession(); router.push(postAuthDestination(locale, payload.user.role, nextPath)); router.refresh(); return;
      }
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; fieldErrors?: Errors; issues?: Array<{ path: string; message: string }> };
      const issueErrors = (payload.issues ?? []).reduce<Errors>((result, issue) => {
        const field = issue.path.split(".")[0];
        if (field && !result[field]) result[field] = localizeServerIssue(issue.message, locale);
        return result;
      }, {});
      const responseErrors = Object.keys(issueErrors).length ? issueErrors : payload.fieldErrors;
      if (responseErrors) { setErrors(responseErrors); const firstError = Object.keys(responseErrors)[0]; if (firstError) focusField(firstError); } else setFeedback({ tone: "error", text: authErrorText(payload.error, payload.message, locale) });
    } catch { setFeedback({ tone: "error", text: locale === "ar" ? "خدمة الحساب غير متاحة الآن. لم يتم تسجيل الدخول أو حفظ أي بيانات." : "The account service is unavailable. Nothing was signed in or saved." }); }
    finally { setPending(false); }
  }

  function passwordField(name = "password", label = t("auth.password")) { const errorId = `${name}-error`; return <div><Label htmlFor={name}>{label}</Label><div className="relative"><Input id={name} name={name} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? errorId : undefined} className="pe-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-canvas" aria-label={showPassword ? (locale === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (locale === "ar" ? "إظهار كلمة المرور" : "Show password")}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div><FieldError id={errorId}>{errors[name]}</FieldError></div>; }

  return <div className="overflow-hidden rounded-3xl border border-line bg-surface-strong shadow-lift lg:grid lg:grid-cols-[.82fr_1.18fr]">
    <aside className="relative hidden min-h-[40rem] overflow-hidden bg-brand-strong p-10 text-white lg:flex lg:flex-col"><div className="absolute -start-24 top-8 size-72 rounded-full bg-accent/35 blur-3xl" /><div className="surface-grid absolute inset-0 opacity-25" /><span className="relative grid size-12 place-items-center rounded-2xl bg-white text-brand-strong"><LockKeyhole className="size-5" /></span><div className="relative mt-auto"><p className="text-xs font-black uppercase tracking-[.25em] text-[#d9a16f]">JYS account</p><h2 className="mt-4 font-display text-4xl font-semibold">{locale === "ar" ? "طلباتك، محفوظة بوضوح." : "Your orders, kept clear."}</h2><p className="mt-4 max-w-sm text-sm leading-7 text-white/60">{locale === "ar" ? "تابع حالة الطلب، واحفظ العناوين والمنتجات التي تحتاجها لاحقاً." : "Track order status, keep delivery addresses and save products for the next restock."}</p></div></aside>
    <section className="p-6 sm:p-10 lg:p-12"><div className="mb-9"><span className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent lg:hidden">{mode === "register" ? <UserRound className="size-5" /> : <Mail className="size-5" />}</span><h1 className="font-display text-4xl font-semibold">{t(titles[mode][0])}</h1><p className="mt-3 text-muted">{t(titles[mode][1])}</p></div>
      {registrationUnavailable ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{locale === "ar" ? "المدن غير متاحة من قاعدة البيانات، لذلك لا يمكن إنشاء حساب آمن الآن." : "Cities are unavailable from the database, so account creation is disabled."}</div> : null}
      {feedback ? <div role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" : "mb-5 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm font-semibold text-accent"}>{feedback.text}</div> : null}
      <form onSubmit={submit} noValidate className="space-y-5">
        {mode === "register" ? <><div><Label htmlFor="name">{t("auth.name")}</Label><Input id="name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} /><FieldError id="name-error">{errors.name}</FieldError></div><div><Label htmlFor="phone">{t("auth.phone")}</Label><Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="059 000 0000" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} /><FieldError id="phone-error">{errors.phone}</FieldError></div></> : null}
        {mode !== "reset" ? <div><Label htmlFor="email">{t("auth.email")}</Label><Input id="email" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} /><FieldError id="email-error">{errors.email}</FieldError></div> : null}
        {mode === "register" ? <><div><Label htmlFor="cityId">{t("auth.city")}</Label><Select id="cityId" name="cityId" value={cityId} onChange={(event) => { setCityId(event.target.value); setAreaId(""); }} disabled={registrationUnavailable} aria-invalid={Boolean(errors.cityId)} aria-describedby={errors.cityId ? "cityId-error" : undefined}><option value="">—</option>{locations?.cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><FieldError id="cityId-error">{errors.cityId}</FieldError></div><div><Label htmlFor="register-area">{t("checkout.area")}</Label><Select id="register-area" name="areaId" value={areaId} onChange={(event) => setAreaId(event.target.value)} disabled={!city}><option value="">—</option>{city?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div><div><Label htmlFor="addressLine">{t("auth.address")}</Label><Textarea id="addressLine" name="addressLine" autoComplete="street-address" aria-invalid={Boolean(errors.addressLine)} aria-describedby={errors.addressLine ? "addressLine-error" : undefined} /><FieldError id="addressLine-error">{errors.addressLine}</FieldError></div></> : null}
        {["login", "register", "reset"].includes(mode) ? passwordField() : null}{mode === "register" || mode === "reset" ? passwordField("confirmPassword", t("auth.confirmPassword")) : null}
        {mode === "login" ? <div className="text-end"><Link href={`/${locale}/forgot-password`} className="text-sm font-bold text-accent hover:underline">{t("auth.forgot")}</Link></div> : null}
        <Button type="submit" size="lg" disabled={!hydrated || pending || registrationUnavailable} className="w-full">{pending ? t("common.loading") : t("auth.submit")}<ArrowUpRight className="size-4 rtl:-scale-x-100" /></Button>
      </form>
      {mode === "login" ? <p className="mt-7 text-center text-sm text-muted">{t("auth.noAccount")} <Link href={`/${locale}/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-black text-ink underline decoration-accent/40 underline-offset-4">{t("auth.register")}</Link></p> : mode === "register" ? <p className="mt-7 text-center text-sm text-muted">{t("auth.hasAccount")} <Link href={`/${locale}/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-black text-ink underline decoration-accent/40 underline-offset-4">{t("auth.login")}</Link></p> : null}
    </section>
  </div>;
}
