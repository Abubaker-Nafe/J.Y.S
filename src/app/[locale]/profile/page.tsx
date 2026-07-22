import{notFound}from"next/navigation";import{isLocale}from"@/lib/i18n/config";import{ProfileForm}from"@/components/storefront/profile-form";export default async function Page({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();return <ProfileForm locale={locale}/>}

