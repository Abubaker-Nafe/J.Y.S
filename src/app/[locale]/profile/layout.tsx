import{notFound}from"next/navigation";import{isLocale}from"@/lib/i18n/config";import{AccountShell}from"@/components/storefront/account-shell";export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();return <AccountShell locale={locale}>{children}</AccountShell>}

