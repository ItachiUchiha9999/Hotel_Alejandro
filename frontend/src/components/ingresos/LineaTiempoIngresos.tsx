"use client";
import { useState } from "react";
import { ORIGENES_INGRESOS, fechaIngreso, monedaIngreso, type ReporteIngresos } from "@/lib/ingresos";

export function LineaTiempoIngresos({ reporte }: { reporte: ReporteIngresos }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const activo = reporte.serie.find(p => p.inicio === seleccionado) ?? reporte.serie.findLast(p => p.total > 0) ?? reporte.serie.at(-1);
  const ancho = Math.max(780,reporte.serie.length * 62 + 100); const alto = 300;
  const x0 = 65; const x1 = ancho - 35; const y0 = 250; const altura = 215;
  const maximo = Math.max(1,...reporte.serie.map(p => p.total));
  const x = (i: number) => reporte.serie.length <= 1 ? (x0 + x1) / 2 : x0 + i / (reporte.serie.length - 1) * (x1 - x0);
  const y = (valor: number) => y0 - valor / maximo * altura;
  const trazado = (tipo: "total" | keyof typeof reporte.serie[number]["origenes"]) => reporte.serie.map((p,i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(tipo === "total" ? p.total : p.origenes[tipo])}`).join(" ");
  const compacto = (valor: number) => new Intl.NumberFormat("es-AR",{ notation: "compact", maximumFractionDigits: 1 }).format(valor);
  const etiqueta = (valor: string) => reporte.agrupacion === "MES" ? new Date(`${valor}T12:00:00Z`).toLocaleDateString("es-AR",{ month: "short",year: "2-digit",timeZone: "UTC" }) : `${valor.slice(8,10)}/${valor.slice(5,7)}`;
  return <>
    <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-carbon/70"><span className="inline-flex items-center gap-2 font-semibold"><span className="h-1 w-5 rounded bg-gold-dark" />Ingreso total</span>{ORIGENES_INGRESOS.map(o => <span key={o.id} className="inline-flex items-center gap-2"><span className="h-0.5 w-5" style={{ background:o.color }} />{o.nombre}</span>)}</div>
    <div className="overflow-x-auto pb-2"><svg width={ancho} viewBox={`0 0 ${ancho} ${alto}`} className="max-w-none" role="group" aria-label="Gráfico de líneas de ingresos totales por período. Seleccioná un punto para ver el detalle.">
      <title>Evolución de ingresos: total, alojamiento, servicios y consumos, en pesos argentinos</title>
      {[0,0.25,0.5,0.75,1].map(fraccion => <g key={fraccion}><line x1={x0} x2={x1} y1={y(maximo * fraccion)} y2={y(maximo * fraccion)} stroke="#e8e0d4" strokeDasharray="4 5" /><text x={x0 - 8} y={y(maximo * fraccion) + 4} textAnchor="end" fontSize="10" fill="#756f67">${compacto(maximo * fraccion)}</text></g>)}
      {ORIGENES_INGRESOS.map(o => <path key={o.id} d={trazado(o.id)} fill="none" stroke={o.color} strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />)}
      <path d={trazado("total")} fill="none" stroke="#b8893f" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {reporte.serie.map((p,i) => <g key={p.inicio} role="button" tabIndex={0} aria-pressed={activo?.inicio === p.inicio} aria-label={`${fechaIngreso(p.desde)} al ${fechaIngreso(p.hasta)}: ${monedaIngreso(p.total)}`}
        onClick={() => setSeleccionado(p.inicio)} onFocus={() => setSeleccionado(p.inicio)} onMouseEnter={() => setSeleccionado(p.inicio)}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSeleccionado(p.inicio); } }} className="cursor-pointer outline-none">
        {activo?.inicio === p.inicio && <line x1={x(i)} x2={x(i)} y1={25} y2={y0} stroke="#b8893f" strokeDasharray="2 4" opacity={0.4} />}
        <circle cx={x(i)} cy={y(p.total)} r={18} fill="transparent" /><circle cx={x(i)} cy={y(p.total)} r={activo?.inicio === p.inicio ? 6 : 4} fill="#b8893f" stroke="white" strokeWidth={2}><title>{monedaIngreso(p.total)}</title></circle>
        <text x={x(i)} y={y0 + 25} textAnchor="middle" fontSize={10} fill="#756f67">{etiqueta(p.inicio)}</text>
      </g>)}
    </svg></div>
    {activo && <div className="mt-4 rounded-lg border border-line bg-bone/50 p-4" aria-live="polite"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{fechaIngreso(activo.desde)} al {fechaIngreso(activo.hasta)}</strong><span>Ingreso total: <strong>{monedaIngreso(activo.total)}</strong></span></div><div className="grid gap-3 sm:grid-cols-3">{ORIGENES_INGRESOS.map(o => <div key={o.id}><p className="text-xs text-carbon/60">{o.nombre}</p><p className="mt-1 font-semibold tabular-nums" style={{ color:o.color }}>{monedaIngreso(activo.origenes[o.id])}</p></div>)}</div></div>}
  </>;
}
