"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, LoaderCircle, LogOut, MapPinned, PackageSearch, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { buttonStyles } from "@/components/ui/button";
import { useStore } from "./store-provider";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AccountShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, sessionReady, clearCustomerSession } = useStore(); const t = (key: string) => translate(locale, key);
  async function logout() { try { await fetch("/api/auth/logout", { method: "POST" }); } finally { clearCustomerSession(); router.push(`/${locale}`); router.refresh(); } }
  if (!sessionReady) return <div className="container-shell grid min-h-[28rem] place-items-center" role="status" aria-live="polite"><LoaderCircle className="size-8 animate-spin text-accent" aria-hidden="true" /><span className="sr-only">{t("common.loading")}</span></div>;
  if (!user) return <div className="container-shell py-20"><div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-10 text-center"><UserRound className="mx-auto size-10 text-accent" /><h1 className="mt-5 font-display text-3xl font-semibold">{t("checkout.signin")}</h1><p className="mt-3 text-muted">{t("auth.loginText")}</p><Link href={`/${locale}/login?next=${encodeURIComponent(pathname)}`} className={buttonStyles({ className: "mt-6" })}>{t("auth.login")}</Link></div></div>;
  const links = [
    { href: `/${locale}/profile`, label: t("account.overview"), Icon: UserRound, exact: true },
    { href: `/${locale}/profile/addresses`, label: t("account.addresses"), Icon: MapPinned, exact: false },
    { href: `/${locale}/profile/orders`, label: t("account.orders"), Icon: PackageSearch, exact: false },
  ];
  return <div className="container-shell py-10 md:py-14"><header className="mb-8 flex flex-col gap-4 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.22em] text-accent">{locale === "ar" ? "حساب JYS" : "JYS account"}</p><h1 className="mt-2 font-display text-4xl font-semibold">{t("account.title")}</h1><p className="mt-2 text-sm text-muted">{user.name} · <span dir="ltr">{user.email}</span></p></div><Link href={`/${locale}`} className={buttonStyles({ variant: "secondary", size: "sm" })}><House className="size-4" />{t("nav.home")}</Link></header><div className="grid gap-8 lg:grid-cols-[14rem_1fr]"><aside data-no-print><nav aria-label={t("account.title")} className="flex gap-2 overflow-auto rounded-2xl border border-line bg-surface p-2 lg:flex-col">{links.map(({ href, label, Icon, exact }) => { const active = exact ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition", active ? "bg-brand-strong text-white" : "hover:bg-canvas")}><Icon className="size-4" />{label}</Link>; })}<button onClick={logout} className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50"><LogOut className="size-4" />{t("account.logout")}</button></nav></aside><div className="min-w-0">{children}</div></div></div>;
}
