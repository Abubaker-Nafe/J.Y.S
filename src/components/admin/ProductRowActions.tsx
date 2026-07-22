"use client";

import { useRouter } from "next/navigation";
import type { AdminLocale } from "@/lib/admin/types";
import { ConfirmAction } from "./MutationFeedback";

export function ProductRowActions({ id, archived, locale }: { id: string; archived: boolean; locale: AdminLocale }) {
  const router = useRouter();
  return archived ? (
    <ConfirmAction locale={locale} label={locale === "ar" ? "استعادة" : "Restore"} confirmMessage={locale === "ar" ? "استعادة المنتج كمنتج مخفي؟" : "Restore this product as hidden?"} url={`/api/admin/products/${id}/restore`} method="POST" onSuccess={() => router.refresh()} />
  ) : (
    <ConfirmAction danger locale={locale} label={locale === "ar" ? "أرشفة" : "Archive"} confirmMessage={locale === "ar" ? "أرشفة المنتج؟ سيختفي من المتجر مع الاحتفاظ بسجل الطلبات." : "Archive this product? It will leave the storefront while order history remains intact."} url={`/api/admin/products/${id}`} onSuccess={() => router.refresh()} />
  );
}
