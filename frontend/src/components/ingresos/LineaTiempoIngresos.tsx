"use client";
import { useState, useEffect, useRef } from "react";
import { ORIGENES_INGRESOS, fechaIngreso, monedaIngreso, type ReporteIngresos } from "@/lib/ingresos";

export function LineaTiempoIngresos({ reporte }: { reporte: ReporteIngresos }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [animar, setAnimar] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const activo = reporte.serie.find(p => p.inicio === seleccionado) ?? reporte.serie.findLast(p => p.total > 0) ?? reporte.serie.at(-1);
  const ancho = Math.max(780, reporte.serie.length * 62 + 100);
  const alto = 300;
  const x0 = 65;
  const x1 = ancho - 35;
  const y0 = 250;
  const altura = 215;
  const maximo = Math.max(1, ...reporte.serie.map(p => p.total));
  const x = (i: number) => reporte.serie.length <= 1 ? (x0 + x1) / 2 : x0 + i / (reporte.serie.length - 1) * (x1 - x0);
  const y = (valor: number) => y0 - valor / maximo * altura;
  const trazado = (tipo: "total" | keyof typeof reporte.serie[number]["origenes"]) => reporte.serie.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(tipo === "total" ? p.total : p.origenes[tipo])}`).join(" ");
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const etiqueta = (valor: string) => reporte.agrupacion === "MES" ? new Date(`${valor}T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" }) : `${valor.slice(8, 10)}/${valor.slice(5, 7)}`;

  // Trigger animation on mount
  useEffect(() => {
    setAnimar(false);
    // Small delay to ensure SVG is rendered
    requestAnimationFrame(() => {
      setAnimar(true);
    });
  }, [reporte.serie.length, reporte.agrupacion]);

  // Calculate path lengths for stroke animation
  const pathLengths = useRef<Record<string, number>>({});
  useEffect(() => {
    if (svgRef.current) {
      const paths = svgRef.current.querySelectorAll("path[data-path-id]");
      paths.forEach((path) => {
        const pathEl = path as SVGPathElement;
        const length = pathEl.getTotalLength();
        pathLengths.current[pathEl.dataset.pathId || ""] = length;
      });
    }
  }, [animar, reporte.serie]);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-carbon/70">
        <span className="inline-flex items-center gap-2 font-semibold animate-fade-in stagger-1">
          <span className="h-1 w-5 rounded bg-gold-dark" />Ingreso total
        </span>
        {ORIGENES_INGRESOS.map((o, idx) => (
          <span key={o.id} className="inline-flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${100 + idx * 50}ms` }}>
            <span className="h-1 w-5 rounded" style={{ background: o.color }} />{o.nombre}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <svg
          ref={svgRef}
          width={ancho}
          viewBox={`0 0 ${ancho} ${alto}`}
          className="max-w-none"
          role="group"
          aria-label="Gráfico de líneas de ingresos totales por período. Seleccioná un punto para ver el detalle."
        >
          <title>Evolución de ingresos: total, alojamiento, servicios y consumos, en pesos argentinos</title>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(fraccion => (
            <g key={fraccion} className="animate-fade-in stagger-2">
              <line x1={x0} x2={x1} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" />
              <text x={x0 - 8} y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">{compacto(maximo * fraccion)}</text>
            </g>
          ))}
          {/* Origin lines (dashed) */}
          {ORIGENES_INGRESOS.map((o, idx) => {
            const pathData = trazado(o.id);
            const length = pathLengths.current[`origen-${o.id}`] || 0;
            return (
              <path
                key={o.id}
                data-path-id={`origen-${o.id}`}
                d={pathData}
                fill="none"
                stroke={o.color}
                strokeWidth={2.5}
                strokeDasharray="7 4"
                strokeLinejoin="round"
                className={`animate-fade-in stagger-${(idx % 6) + 3}`}
                style={{
                  strokeDasharray: animar ? `${length} ${length}` : "7 4",
                  strokeDashoffset: animar ? 0 : length,
                  transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke-dasharray 0.3s",
                }}
              />
            );
          })}
          {/* Total line (solid, animated drawing) */}
          {(() => {
            const pathData = trazado("total");
            const length = pathLengths.current["total"] || 0;
            return (
              <path
                data-path-id="total"
                d={pathData}
                fill="none"
                stroke="#b08d48"
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="animate-fade-in stagger-2"
                style={{
                  strokeDasharray: animar ? `${length} ${length}` : `${length} ${length}`,
                  strokeDashoffset: animar ? 0 : length,
                  transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            );
          })()}
          {/* Points and interactions */}
          {reporte.serie.map((p, i) => (
            <g
              key={p.inicio}
              role="button"
              tabIndex={0}
              aria-pressed={activo?.inicio === p.inicio}
              aria-label={`${fechaIngreso(p.desde)} al ${fechaIngreso(p.hasta)}: ${monedaIngreso(p.total)}`}
              onClick={() => setSeleccionado(p.inicio)}
              onFocus={() => setSeleccionado(p.inicio)}
              onMouseEnter={() => setSeleccionado(p.inicio)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSeleccionado(p.inicio); } }}
              className="cursor-pointer outline-none"
              style={{ animationDelay: `${(i % 8) * 80}ms` }}
            >
              {activo?.inicio === p.inicio && (
                <line
                  x1={x(i)} x2={x(i)} y1={25} y2={y0}
                  stroke="#b08d48" strokeDasharray="3 4" opacity={0.75}
                  className="animate-fade-in stagger-2"
                />
              )}
              {/* Hit area - larger invisible circle for easier interaction */}
              <circle cx={x(i)} cy={y(p.total)} r={18} fill="transparent" />
              {/* Animated point */}
              <circle
                cx={x(i)}
                cy={y(p.total)}
                r={activo?.inicio === p.inicio ? 7 : 5}
                fill="#b08d48"
                stroke="white"
                strokeWidth={2}
                className={`animate-scale-in stagger-${(i % 8) + 3} transition-all duration-200`}
                style={{
                  transformOrigin: `${x(i)}px ${y(p.total)}px`,
                  r: activo?.inicio === p.inicio ? 7 : 5,
                }}
              >
                <title>{monedaIngreso(p.total)}</title>
              </circle>
              <text x={x(i)} y={y0 + 25} textAnchor="middle" fontSize={10} fill="#756f67" className="animate-fade-in stagger-3">{etiqueta(p.inicio)}</text>
            </g>
          ))}
        </svg>
      </div>
      {activo && (
        <div className="mt-4 rounded-lg border border-line bg-bone/50 p-4 animate-slide-up-slow" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <strong>{fechaIngreso(activo.desde)} al {fechaIngreso(activo.hasta)}</strong>
            <span>Ingreso total: <strong>{monedaIngreso(activo.total)}</strong></span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {ORIGENES_INGRESOS.map((o, idx) => (
              <div key={o.id} className="animate-slide-in stagger-4" style={{ animationDelay: `${idx * 50}ms` }}>
                <p className="text-xs text-carbon/60">{o.nombre}</p>
                <p className="mt-1 font-semibold tabular-nums" style={{ color: o.color }}>{monedaIngreso(activo.origenes[o.id])}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}