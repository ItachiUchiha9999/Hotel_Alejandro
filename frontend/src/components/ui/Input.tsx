import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalido?: boolean;
}

export function Input({ invalido, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalido || undefined}
      className={cn(
        "h-10 w-full rounded-md border bg-white px-3 text-sm text-carbon",
        "placeholder:text-carbon/35",
        "focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold",
        "disabled:cursor-not-allowed disabled:bg-bone/60 disabled:text-carbon/50",
        invalido ? "border-danger" : "border-line",
        className,
      )}
    />
  );
}