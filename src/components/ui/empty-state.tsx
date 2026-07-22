"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { buttonStyles } from "./button";

export function EmptyState({ title, text, actionLabel, actionHref, actionOnClick, compact = false }: { title: string; text: string; actionLabel?: string; actionHref?: string; actionOnClick?: () => void; compact?: boolean }) {
  return (
    <section className={`rounded-3xl border border-dashed border-line bg-surface/70 text-center ${compact ? "p-8" : "px-6 py-16"}`}>
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-ink text-white"><PackageOpen aria-hidden="true" className="size-6" /></span>
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>
      {actionLabel && actionOnClick ? <button type="button" onClick={actionOnClick} className={buttonStyles({ className: "mt-6" })}>{actionLabel}</button> : actionLabel && actionHref ? <Link href={actionHref} className={buttonStyles({ className: "mt-6" })}>{actionLabel}</Link> : null}
    </section>
  );
}
