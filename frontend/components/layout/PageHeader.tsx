import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Miga de pan corta: "STK-01 · SPRINT 1" */
  eyebrow?: string;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}

/**
 * Encabezado de vista. Va como primer elemento de TODA pantalla,
 * antes de las cards. El eyebrow lleva el código de la historia de
 * usuario: sirve para que en la defensa se vea qué requerimiento cumple
 * cada pantalla.
 */
export function PageHeader({
  eyebrow,
  titulo,
  descripcion,
  acciones,
}: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold-dark">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-3xl leading-tight text-carbon">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1.5 max-w-2xl text-sm text-carbon/60">
            {descripcion}
          </p>
        )}
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </div>
  );
}
