import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Envoltorio de un campo de formulario: etiqueta arriba, control,
 * y mensaje de error o ayuda abajo. Usar SIEMPRE en vez de escribir
 * <label> sueltos, para que todos los formularios midan igual.
 */
export function Field({
  label,
  htmlFor,
  error,
  ayuda,
  requerido,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide text-carbon/70"
      >
        {label}
        {requerido && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-carbon/50">{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Grilla de 2 columnas (1 en mobile) para ordenar los campos. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
      {children}
    </div>
  );
}
