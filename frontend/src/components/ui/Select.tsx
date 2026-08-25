import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalido?: boolean;
}

export function Select({ invalido, className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalido || undefined}
        className={cn(
          "h-10 w-full appearance-none rounded-md border bg-white px-3 pr-9 text-sm text-carbon",
          "focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60",
          "disabled:cursor-not-allowed disabled:bg-bone/60 disabled:text-carbon/50",
          invalido ? "border-danger" : "border-line",
          className,
        )}
      >
        {children}
      </select>

      {/* Flecha propia: el select nativo se ve distinto en cada navegador */}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon/50"
        fill="currentColor"
      >
        <path d="M5.5 7.5 10 12l4.5-4.5z" />
      </svg>
    </div>
  );
}