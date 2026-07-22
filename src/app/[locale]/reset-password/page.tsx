import { notFound } from "next/navigation";import { isLocale } from "@/lib/i18n/config";import { AuthForm } from "@/components/storefront/auth-form";
export default async function ResetPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{token?:string}>}){const[{locale:raw},query]=await Promise.all([params,searchParams]);if(!isLocale(raw))notFound();return <div className="container-shell max-w-5xl py-12 md:py-16"><AuthForm locale={raw} mode="reset" token={query.token}/></div>}

