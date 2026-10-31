import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Miga de pan corta: "SIGH · RES-01" */
  eyebrow?: string;
  // New English props
  title?: string;
  description?: string;
  actions?: ReactNode;
  // Old Spanish props (backward compatibility)
  titulo?: string;
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
  title,
  titulo,
  description,
  descripcion,
  actions,
  acciones,
}: PageHeaderProps) {
  // Support both English and Spanish prop names
  const resolvedTitle = title || titulo;
  const resolvedDescription = description || descripcion;
  const resolvedActions = actions || acciones;

  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gold-600">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-3xl leading-tight text-neutral-900">
          {resolvedTitle}
        </h1>
        {resolvedDescription && (
          <p className="mt-1.5 max-w-2xl text-sm text-neutral-500">
            {resolvedDescription}
          </p>
        )}
      </div>
      {resolvedActions && <div className="flex items-center gap-2">{resolvedActions}</div>}
    </div>
  );
}