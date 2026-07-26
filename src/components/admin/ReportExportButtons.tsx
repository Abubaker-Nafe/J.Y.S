"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { AdminLocale } from "@/lib/admin/types";
import styles from "./admin.module.css";

const exportTypes = ["orders", "sales", "products", "inventory", "customers"] as const;
type ExportType = (typeof exportTypes)[number];

function downloadFilename(header: string | null, type: ExportType) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename="?([^";]+)"?/i)?.[1];
  try {
    return decodeURIComponent(encoded ?? plain ?? `jys-${type}.csv`);
  } catch {
    return `jys-${type}.csv`;
  }
}

export function ReportExportButtons({ locale, baseQuery }: { locale: AdminLocale; baseQuery: string }) {
  const [active, setActive] = useState<ExportType | null>(null);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const labels: Record<ExportType, string> = locale === "ar"
    ? { orders: "الطلبات", sales: "المبيعات", products: "المنتجات", inventory: "المخزون", customers: "العملاء" }
    : { orders: "Orders", sales: "Sales", products: "Products", inventory: "Inventory", customers: "Customers" };

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function runExport(type: ExportType) {
    if (active) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 20_000);
    setActive(type);
    setError("");
    try {
      const params = new URLSearchParams(baseQuery);
      params.set("type", type);
      const response = await fetch(`/api/admin/reports/csv?${params}`, {
        headers: { Accept: "text/csv" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
        throw new Error(payload?.message ?? payload?.error ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("The export returned an empty file");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFilename(response.headers.get("Content-Disposition"), type);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      if (controller.signal.reason === "timeout") {
        setError(locale === "ar" ? "استغرق التصدير وقتًا أطول من المتوقع. حاول مجددًا." : "The export timed out. Please try again.");
      } else if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(locale === "ar" ? "تعذر تنزيل التقرير. حاول مجددًا." : "The report could not be downloaded. Please try again.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      setActive(null);
    }
  }

  return (
    <div>
      <div className={styles.tableActions}>
        {exportTypes.map((type) => (
          <button key={type} className={styles.buttonSecondary} type="button" disabled={active !== null} onClick={() => void runExport(type)}>
            {active === type ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            {locale === "ar" ? `تصدير ${labels[type]}` : `Export ${labels[type]}`}
          </button>
        ))}
      </div>
      {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
    </div>
  );
}
