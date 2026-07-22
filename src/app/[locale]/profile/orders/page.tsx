import { notFound } from "next/navigation";import { isLocale } from "@/lib/i18n/config";import { OrderHistory } from "@/components/storefront/order-history";export default async function Page({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();return <OrderHistory locale={locale}/>}

