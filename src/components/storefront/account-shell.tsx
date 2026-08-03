"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, LayoutDashboard, LoaderCircle, LogOut, MapPinned, PackageSearch, RefreshCw, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { buttonStyles } from "@/components/ui/button";
import { useStore } from "./store-provider";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AccountShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, sessionReady, sessionStatus, sessionError, clearCustomerSession, refreshSession } = useStore(); const t = (key: string) => translate(locale, key);
  const loginHref = `/${locale}/login?next=${encodeURIComponent(pathname)}`;
  async function logout() { try { await fetch("/api/auth/logout", { method: "POST" }); } finally { clearCustomerSession(); router.push(`/${locale}`); router.refresh(); } }
  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.replace(loginHref);
  }, [loginHref, router, sessionStatus]);
  if (!sessionReady) return <div className="container-shell grid min-h-[28rem] place-items-center" role="status" aria-live="polite"><LoaderCircle className="size-8 animate-spin text-accent" aria-hidden="true" /><span className="sr-only">{t("common.loading")}</span></div>;
  if (sessionStatus === "error") return <div className="container-shell py-20"><div role="alert" className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-10 text-center"><UserRound className="mx-auto size-10 text-red-700" /><h1 className="mt-5 font-display text-3xl font-semibold">{locale === "ar" ? "تعذر التحقق من الجلسة" : "We couldn’t verify your session"}</h1><p className="mt-3 text-red-900/75">{sessionError === "timeout" ? (locale === "ar" ? "استغرق اتصال الحساب وقتاً طويلاً. تحقق من الخادم وحاول مجدداً." : "The account request timed out. Check the server and try again.") : (locale === "ar" ? "خدمة الحساب غير متاحة حالياً. لم يتم تسجيل خروجك تلقائياً." : "The account service is currently unavailable. You were not treated as signed out.")}</p><button type="button" onClick={() => void refreshSession()} className={buttonStyles({ className: "mt-6" })}><RefreshCw className="size-4" />{t("common.retry")}</button></div></div>;
  if (!user) return <div className="container-shell grid min-h-[28rem] place-items-center" role="status" aria-live="polite"><LoaderCircle className="size-8 animate-spin text-accent" aria-hidden="true" /><span className="sr-only">{locale === "ar" ? "جارٍ التحويل إلى تسجيل الدخول" : "Redirecting to sign in"}</span></div>;
  const displayName = typeof user.name === "string" ? user.name.trim() : "";
  const links = [
    ...(user.role === "ADMIN"
      ? [{ href: `/${locale}/admin`, label: locale === "ar" ? "لوحة الإدارة" : "Admin dashboard", Icon: LayoutDashboard, exact: false }]
      : []),
    { href: `/${locale}/profile`, label: t("account.overview"), Icon: UserRound, exact: true },
    { href: `/${locale}/profile/addresses`, label: t("account.addresses"), Icon: MapPinned, exact: false },
    { href: `/${locale}/profile/orders`, label: t("account.orders"), Icon: PackageSearch, exact: false },
  ];
  return <div className="container-shell min-w-0 py-8 md:py-14"><header className="mb-6 flex min-w-0 flex-col gap-4 border-b border-line pb-6 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-7"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.22em] text-accent">{locale === "ar" ? "حساب JYS" : "JYS account"}</p><h1 className="mt-2 font-display text-4xl font-semibold">{t("account.title")}</h1>{displayName ? <p className="break-anywhere mt-2 text-lg font-bold">{locale === "ar" ? `مرحباً ${displayName}` : `Hi ${displayName}`}</p> : null}<p className="break-anywhere mt-1 text-sm text-muted" dir="ltr">{user.email}</p></div><Link href={`/${locale}`} className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full sm:w-auto" })}><House className="size-4" />{t("nav.home")}</Link></header><div className="grid min-w-0 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8"><aside className="min-w-0 max-w-full" data-no-print><nav aria-label={t("account.title")} className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-2 lg:flex lg:flex-col">{links.map(({ href, label, Icon, exact }) => { const active = exact ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold leading-5 transition lg:gap-3 lg:px-4 lg:py-3", active ? "bg-brand-strong text-white" : "hover:bg-canvas")}><Icon className="size-4 shrink-0" /><span className="break-anywhere">{label}</span></Link>; })}<button onClick={logout} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-bold leading-5 text-red-700 hover:bg-red-50 lg:gap-3 lg:px-4 lg:py-3"><LogOut className="size-4 shrink-0" /><span className="break-anywhere">{t("account.logout")}</span></button></nav></aside><div className="min-w-0 max-w-full">{children}</div></div></div>;
}
