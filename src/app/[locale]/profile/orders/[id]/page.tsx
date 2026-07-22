import{notFound}from"next/navigation";import{isLocale}from"@/lib/i18n/config";import{OrderDetail}from"@/components/storefront/order-detail";export default async function Page({params}:{params:Promise<{locale:string;id:string}>}){const{locale,id}=await params;if(!isLocale(locale))notFound();return <OrderDetail locale={locale} orderId={id}/>}

