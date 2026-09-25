/**
 * Une clases de Tailwind ignorando valores falsy.
 * Lo usan todos los componentes de UI. Antes se importaba desde "@/lib/cn"
 * pero el archivo no existía, así que el proyecto entero no compilaba.
 */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
