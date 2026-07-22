import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export function buttonStyles({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent/60",
    variant === "primary" && "bg-brand-strong text-white shadow-sm hover:-translate-y-0.5 hover:bg-accent hover:shadow-lg",
    variant === "secondary" && "border border-line bg-surface-strong text-ink hover:border-ink/30 hover:bg-white",
    variant === "quiet" && "text-ink hover:bg-ink/6",
    variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
    size === "sm" && "min-h-9 px-4 text-sm",
    size === "md" && "min-h-11 px-5 text-sm",
    size === "lg" && "min-h-13 px-7 text-base",
    size === "icon" && "size-11 shrink-0 p-0",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; children: ReactNode }

export function Button({ className, variant, size, type = "button", children, ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props}>{children}</button>;
}

