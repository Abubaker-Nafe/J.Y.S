"use client";

import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { useStore } from "./store-provider";

export function HeaderActions({ locale }: { locale: Locale }) {
  const { cartCount, wishlist } = useStore();
  const actions = [
    { href: `/${locale}/wishlist`, label: translate(locale, "nav.wishlist"), Icon: Heart, count: wishlist.length },
    { href: `/${locale}/profile`, label: translate(locale, "nav.account"), Icon: UserRound, count: 0 },
    { href: `/${locale}/cart`, label: translate(locale, "nav.cart"), Icon: ShoppingBag, count: cartCount },
  ];
  return <div className="flex items-center gap-1">{actions.map(({ href, label, Icon, count }) => <Link key={href} href={href} className="group relative grid size-11 place-items-center rounded-full text-ink transition hover:bg-ink/6" aria-label={count ? `${label}, ${count}` : label}><Icon className="size-[21px] stroke-[1.8]" aria-hidden="true" />{count > 0 ? <span className="absolute end-0.5 top-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-black leading-[18px] text-white">{count > 99 ? "99+" : count}</span> : null}</Link>)}</div>;
}

