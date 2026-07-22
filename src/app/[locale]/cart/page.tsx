import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";
import { PageHeading } from "@/components/ui/page-heading";
import { CartClient } from "@/components/storefront/cart-client";
export default async function CartPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;if(!isLocale(raw))notFound();return <div className="container-shell py-12 md:py-16"><PageHeading title={translate(raw,"cart.title")} description={translate(raw,"cart.subtitle")}/><div className="mt-10"><CartClient locale={raw}/></div></div>}

