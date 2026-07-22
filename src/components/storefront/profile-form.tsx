"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Save, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

interface Profile { id: string; name: string; email: string; phone: string | null; createdAt?: string; customerProfile?: { preferredLocale?: string } | null }
type Feedback = { tone: "success" | "error"; text: string } | null;

export function ProfileForm({ locale }: { locale: Locale }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/account/profile", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); const payload = await response.json() as { profile: Profile }; setProfile(payload.profile); })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFeedback({ tone: "error", text: locale === "ar" ? "تعذر تحميل الملف الشخصي." : "Profile could not be loaded." });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [locale]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setFeedback(null); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(form.get("name")), phone: String(form.get("phone")), preferredLocale: String(form.get("preferredLocale")) }) });
      const payload = await response.json().catch(() => ({})) as { profile?: Profile; message?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.message);
      const updated = payload.profile; setProfile((current) => current ? { ...current, ...updated } : updated);
      setFeedback({ tone: "success", text: translate(locale, "account.saved") });
    } catch (error) { setFeedback({ tone: "error", text: locale === "ar" ? "تعذر حفظ الملف. تحقق من الاسم ورقم الهاتف وحاول مجدداً." : error instanceof Error && error.message ? error.message : "Profile could not be saved." }); }
    finally { setPending(false); }
  }
  if (loading) return <div className="grid min-h-64 place-items-center" role="status" aria-live="polite"><LoaderCircle className="size-7 animate-spin text-accent" aria-hidden="true" /><span className="sr-only">{translate(locale, "common.loading")}</span></div>;
  if (!profile) return <p role="alert" className="rounded-2xl bg-red-50 p-5 font-semibold text-red-800">{feedback?.text ?? (locale === "ar" ? "تعذر تحميل الملف الشخصي." : "Profile could not be loaded.")}</p>;
  return <section className="rounded-3xl border border-line bg-surface-strong p-6 shadow-soft md:p-9">
    <div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-brand-strong text-white"><UserRound className="size-5" /></span><div><h2 className="font-display text-2xl font-semibold">{translate(locale, "account.overview")}</h2><p className="text-sm text-muted">{translate(locale, "account.profileText")}</p></div></div>
    {feedback ? <p role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" : "mt-5 rounded-xl bg-accent/5 p-3 text-sm font-semibold text-accent"}>{feedback.text}</p> : null}
    <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
      <div><Label htmlFor="profile-name">{translate(locale, "auth.name")}</Label><Input id="profile-name" name="name" defaultValue={profile.name} required /></div>
      <div><Label htmlFor="profile-email">{translate(locale, "auth.email")}</Label><Input id="profile-email" value={profile.email} disabled dir="ltr" /></div>
      <div><Label htmlFor="profile-phone">{translate(locale, "auth.phone")}</Label><Input id="profile-phone" name="phone" defaultValue={profile.phone ?? ""} type="tel" dir="ltr" required /></div>
      <div><Label htmlFor="profile-locale">{locale === "ar" ? "اللغة المفضلة" : "Preferred language"}</Label><Select id="profile-locale" name="preferredLocale" defaultValue={profile.customerProfile?.preferredLocale ?? locale}><option value="ar">العربية</option><option value="en">English</option></Select></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}><Save className="size-4" />{pending ? translate(locale, "common.loading") : translate(locale, "common.save")}</Button></div>
    </form>
  </section>;
}
