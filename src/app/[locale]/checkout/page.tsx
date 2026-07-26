import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { getPolicyContent, getPublicBusinessSettings } from "@/lib/i18n/content";
import { getStorefrontLocations } from "@/lib/catalog/locations";
import { PageHeading } from "@/components/ui/page-heading";
import { CheckoutClient } from "@/components/storefront/checkout-client";
export default async function CheckoutPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;if(!isLocale(raw))notFound();const[locations,business,noReturn]=await Promise.all([getStorefrontLocations(raw),getPublicBusinessSettings(raw),getPolicyContent("NO_RETURN",raw)]);const policySummary=noReturn.body.split(/\n\s*\n/)[0]||translate(raw,"checkout.policyText");return <div className="container-shell py-12 md:py-16"><PageHeading title={translate(raw,"checkout.title")} description={translate(raw,"checkout.subtitle")}/><div className="mt-10"><CheckoutClient locale={raw} locations={locations} business={business} policySummary={policySummary}/></div></div>}

