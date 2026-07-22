import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { getPublicBusinessSettings } from "@/lib/i18n/content";
import { getStorefrontLocations } from "@/lib/catalog/locations";
import { PageHeading } from "@/components/ui/page-heading";
import { CheckoutClient } from "@/components/storefront/checkout-client";
export default async function CheckoutPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;if(!isLocale(raw))notFound();const[locations,business]=await Promise.all([getStorefrontLocations(raw),getPublicBusinessSettings(raw)]);return <div className="container-shell py-12 md:py-16"><PageHeading title={translate(raw,"checkout.title")} description={translate(raw,"checkout.subtitle")}/><div className="mt-10"><CheckoutClient locale={raw} locations={locations} business={business}/></div></div>}

