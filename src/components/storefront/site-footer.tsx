import Link from "next/link";
import { Banknote, MapPin, Phone } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { BrandMark } from "./brand-mark";
import type { PublicBusinessSettings } from "@/lib/i18n/content";

export function SiteFooter({ locale, business }: { locale: Locale; business: PublicBusinessSettings | null }) {
  const t = (key: string) => translate(locale, key);
  const groups: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
    { title: t("footer.shop"), links: [{ label: t("nav.products"), href: `/${locale}/products` }, { label: t("nav.wishlist"), href: `/${locale}/wishlist` }, { label: t("nav.cart"), href: `/${locale}/cart` }] },
    { title: t("footer.help"), links: [{ label: t("policy.delivery"), href: `/${locale}/delivery` }, { label: t("policy.pickup"), href: `/${locale}/pickup` }, { label: t("policy.returns"), href: `/${locale}/no-returns` }, { label: t("policy.warranty"), href: `/${locale}/warranty` }] },
    { title: t("footer.account"), links: [{ label: t("auth.login"), href: `/${locale}/login` }, { label: t("auth.register"), href: `/${locale}/register` }, { label: t("orders.title"), href: `/${locale}/profile/orders` }, { label: t("policy.privacy"), href: `/${locale}/privacy` }, { label: t("policy.terms"), href: `/${locale}/terms` }] },
  ];
  return <footer className="mt-24 bg-brand-strong text-white" data-no-print>
    <div className="container-shell grid gap-12 py-16 lg:grid-cols-[1.35fr_2fr]">
      <div><BrandMark locale={locale} inverted /><p className="mt-5 max-w-sm text-sm leading-7 text-white/80">{t("footer.about")}</p><div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-white/85"><span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-2"><Banknote className="size-4 text-[#e2ad7d]" />{t("footer.cash")}</span>{business?.location ? <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-2"><MapPin className="size-4 text-[#e2ad7d]" />{business.location}</span> : null}{business?.phone ? <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-2 hover:bg-white/10"><Phone className="size-4 text-[#e2ad7d]" /><span dir="ltr">{business.phone}</span></a> : null}</div></div>
      <div className="grid grid-cols-2 gap-8 md:grid-cols-3">{groups.map((group) => <div key={group.title}><h2 className="mb-4 text-sm font-black text-white">{group.title}</h2><ul className="space-y-2.5">{group.links.map((link) => <li key={link.href}><Link className="text-sm text-white/80 transition hover:text-white" href={link.href}>{link.label}</Link></li>)}</ul></div>)}</div>
    </div>
    <div className="border-t border-white/20"><div className="container-shell flex flex-col gap-2 py-5 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} JYS. {t("footer.rights")}</p><p>{locale === "ar" ? "صُمم للعمل، لا للضجيج." : "Built for the work, not the noise."}</p></div></div>
  </footer>;
}
