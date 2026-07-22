import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-sm font-semibold text-ink", className)} {...props} />;
}

const fieldStyles = "min-h-12 w-full rounded-xl border border-line bg-surface-strong px-4 text-base text-ink shadow-sm transition placeholder:text-muted hover:border-ink/30 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30 disabled:bg-line/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldStyles, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(fieldStyles, "appearance-none bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-20px)_52%,calc(100%-15px)_52%] bg-no-repeat pe-10 rtl:bg-[position:20px_52%,15px_52%]", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldStyles, "min-h-28 resize-y py-3", className)} {...props} />;
});

export function FieldError({ children, id }: { children?: string; id?: string }) {
  return children ? <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-red-700">{children}</p> : null;
}
