import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger"; className?: string }) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-bold", tone === "neutral" && "bg-ink/7 text-ink", tone === "success" && "bg-emerald-700/10 text-emerald-800", tone === "warning" && "bg-amber-600/12 text-amber-800", tone === "danger" && "bg-red-700/10 text-red-800", className)}>{children}</span>;
}

