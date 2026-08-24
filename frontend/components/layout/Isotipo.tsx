/**
 * Marca del hotel en SVG inline (hexágono + corona).
 * Va inline y no como <Image> para que escale nítido en cualquier
 * densidad de pantalla y herede el color con `currentColor` si hace falta.
 */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 72"
      role="img"
      aria-label="Hotel Alejandro I"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon
        points="40,10 62.4,23 62.4,49 40,62 17.6,49 17.6,23"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <polyline
        points="27.6,44.9 32,32.5 36.5,39 40,26.8 43.5,39 48,32.5 52.4,44.9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line
        x1="27.6"
        y1="44.9"
        x2="52.4"
        y2="44.9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32.5" r="1.4" fill="currentColor" />
      <circle cx="40" cy="26.8" r="1.6" fill="currentColor" />
      <circle cx="48" cy="32.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
