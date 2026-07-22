"use client";
import { useEffect } from "react";
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => { const controller = new AbortController(); void fetch(`/api/catalog/products/${encodeURIComponent(productId)}/view`, { method: "POST", signal: controller.signal }).catch(() => undefined); return () => controller.abort(); }, [productId]);
  return null;
}
