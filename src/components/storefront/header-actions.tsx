"use client";

import Link from "next/link";
import { Heart, LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { useStore } from "./store-provider";
import { Tooltip } from "@/components/ui/tooltip";

export function HeaderActions({ locale }: { locale: Locale }) {
  const { cartCount, wishlist, user, sessionReady } = useStore();
  const actions = [
    ...(sessionReady && user?.role === "ADMIN"
      ? [{ href: `/${locale}/admin`, label: locale === "ar" ? "لوحة الإدارة" : "Admin dashboard", Icon: LayoutDashboard, count: 0, className: "hidden sm:grid" }]
      : []),
    { href: `/${locale}/wishlist`, label: translate(locale, "nav.wishlist"), Icon: Heart, count: wishlist.length, className: "grid" },
    { href: `/${locale}/profile`, label: translate(locale, "nav.account"), Icon: UserRound, count: 0, className: "grid" },
    { href: `/${locale}/cart`, label: translate(locale, "nav.cart"), Icon: ShoppingBag, count: cartCount, className: "grid" },
  ];
  return <div className="flex min-w-0 shrink-0 items-center gap-0 sm:gap-1">{actions.map(({ href, label, Icon, count, className }) => <Tooltip key={href} label={label}><Link href={href} className={`${className} group relative size-11 shrink-0 place-items-center rounded-full text-ink transition hover:bg-ink/6`} aria-label={count ? `${label}, ${count}` : label}><Icon className="size-[21px] stroke-[1.8]" aria-hidden="true" />{count > 0 ? <span className="absolute end-0.5 top-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-black leading-[18px] text-white">{count > 99 ? "99+" : count}</span> : null}</Link></Tooltip>)}</div>;
}

