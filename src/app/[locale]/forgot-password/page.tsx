import { notFound } from "next/navigation";import { isLocale } from "@/lib/i18n/config";import { AuthForm } from "@/components/storefront/auth-form";
export default async function ForgotPage({params}:{params:Promise<{locale:string}>}){const{locale:raw}=await params;if(!isLocale(raw))notFound();return <div className="container-shell max-w-5xl py-12 md:py-16"><AuthForm locale={raw} mode="forgot"/></div>}

