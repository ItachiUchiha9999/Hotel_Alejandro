/**
 * Une clases de Tailwind ignorando valores falsy.
 * Evita instalar clsx/classnames: no agregamos dependencias al proyecto.
 *
 * cn("px-4", isActive && "bg-gold", undefined) -> "px-4 bg-gold"
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
