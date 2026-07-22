import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { PageHeading } from "@/components/ui/page-heading";
import { WishlistClient } from "@/components/storefront/wishlist-client";

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  return <div className="container-shell py-12 md:py-16"><PageHeading title={translate(raw, "wishlist.title")} description={translate(raw, "wishlist.subtitle")} /><div className="mt-10"><WishlistClient locale={raw} /></div></div>;
}
