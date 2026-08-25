import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
}

const variantes: Record<Variante, string> = {
  primario:
    "bg-gold text-carbon hover:bg-gold-dark focus-visible:outline-gold shadow-sm",
  secundario:
    "bg-white text-carbon border border-line hover:bg-bone focus-visible:outline-carbon",
  fantasma:
    "bg-transparent text-carbon/70 hover:text-carbon hover:bg-carbon/5 focus-visible:outline-carbon",
  peligro:
    "bg-white text-danger border border-danger/40 hover:bg-danger/5 focus-visible:outline-danger",
};

const tamanos: Record<Tamano, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm",
};

export function Button({
  variante = "primario",
  tamano = "md",
  cargando = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium tracking-wide",
        "transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantes[variante],
        tamanos[tamano],
        className,
      )}
    >
      {cargando && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}