"use client";

import { Card } from '@/components/ui';

interface PuntoFinanciero { pendiente?: boolean; fecha: string; ingresos: number; egresos: number; neto: number; margen_porcentual: number | null; }
const moneda = (valor: number) => valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const monedaCompacta = (valor: number) => new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valor);
const fechaCorta = (valor: string) => new Date(valor + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

export function ComparativaFinanciera({ points: puntos, selectedDate: fechaSeleccionada, onSelectDate: setFechaSeleccionada, period }: {
  points: PuntoFinanciero[];
  selectedDate: string | null;
  onSelectDate: (fecha: string) => void;
  period: 'SEMANA' | 'MES' | 'ANIO';
}) {
  const anual = period === 'ANIO';

  const hayMovimientos = puntos.some(p => p.ingresos !== 0 || p.egresos !== 0);
  if (!hayMovimientos && !anual) return <p className="rounded-lg bg-neutral-50 px-5 py-10 text-center text-sm text-[#514d46]">No hay cobros ni pagos registrados en este período.</p>;

  const ancho = Math.max(900, puntos.length * 64 + 104);
  const alto = 380;
  const izquierda = 76;
  const derecha = 20;
  const arriba = 24;
  const abajo = 48;
  const valores = puntos.flatMap(p => [p.ingresos, p.egresos, p.neto]);
  const mayorValor = Math.max(...valores, 0);
  const menorValor = Math.min(...valores, 0);
  // Escala compartida: las barras parten de cero y la línea puede bajar de él.
  const amplitud = Math.max(mayorValor, Math.abs(menorValor), 1);
  const potencia = 10 ** Math.floor(Math.log10(amplitud / 3));
  const paso = Math.ceil(amplitud / 3 / potencia) * potencia;
  const maximo = Math.max(paso, Math.ceil(mayorValor / paso) * paso);
  const minimo = Math.floor(menorValor / paso) * paso;
  const ticks = Array.from({ length: Math.round((maximo - minimo) / paso) + 1 }, (_, i) => minimo + i * paso);
  const espacio = (ancho - izquierda - derecha) / puntos.length;
  const anchoBarra = Math.min(espacio * 0.40, 42);
  const x = (i: number) => izquierda + espacio * (i + 0.5);
  const y = (valor: number) => arriba + (maximo - valor) / (maximo - minimo) * (alto - arriba - abajo);
  const cero = y(0);
  const linea = puntos.map((p, i) => p.pendiente ? "" : `${i === 0 || puntos[i - 1].pendiente ? "M" : "L"} ${x(i)} ${y(p.neto)}`).join(" ");
  const indiceInicial = puntos.reduce((ultimo, p, i) => p.ingresos !== 0 || p.egresos !== 0 ? i : ultimo, 0);
  const indiceBuscado = puntos.findIndex(p => p.fecha === fechaSeleccionada);
  const indiceSeleccionado = indiceBuscado >= 0 ? indiceBuscado : indiceInicial;
  const seleccionado = puntos[indiceSeleccionado];
  const fechaCompleta = new Date(`${seleccionado.fecha}T12:00:00`).toLocaleDateString("es-AR", anual ? { month: "long", year: "numeric" } : { day: "numeric", month: "long" });
  const estado = seleccionado.pendiente ? "Mes pendiente" : seleccionado.neto < 0 ? "Resultado negativo" : seleccionado.neto > 0 ? "Resultado positivo" : "Sin diferencia";

  return <Card variant="outlined" padding="md">
    <p className="mb-3 text-xs leading-5 text-[#514d46]">Compará ingresos y egresos de cada {anual ? "mes" : "día"}. La línea amarilla muestra el resultado. Deslizá para recorrer el período y seleccioná {anual ? "un mes" : "un día"} para ver el detalle.</p>
    <div className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500" role="region" aria-label={anual ? "Comparativa financiera anual por mes" : "Comparativa financiera diaria; desplazate horizontalmente para ver todos los días"} tabIndex={0}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" style={{ minWidth: ancho }} role="group" aria-label={`Barras de ingresos y egresos y línea del resultado neto por ${anual ? "mes" : "día"}`}>
        {ticks.map(tick => <g key={tick}>
          <line x1={izquierda} x2={ancho - derecha} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#8c8172" : "#e8e0d4"} strokeWidth={tick === 0 ? 1.5 : 1} opacity={tick === 0 ? 1 : 0.55} />
          <text x={izquierda - 12} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="#514d46">{tick < 0 ? "−" : ""}${monedaCompacta(Math.abs(tick))}</text>
        </g>)}
        <rect x={izquierda + espacio * indiceSeleccionado} y={arriba} width={espacio} height={alto - arriba - abajo} fill="#f2f3f1" opacity="0.8" pointerEvents="none" />
        {puntos.map((p, i) => <g key={`barras-${p.fecha}`}>
          {p.pendiente && <rect x={izquierda + espacio * i} y={arriba} width={espacio} height={alto - arriba - abajo} fill="#faf9f6" />}
          {p.ingresos !== 0 && <rect x={x(i) - anchoBarra - 2} y={Math.min(cero, y(p.ingresos))} width={anchoBarra} height={Math.abs(cero - y(p.ingresos))} rx="1" fill="#008580" />}
          {p.egresos !== 0 && <rect x={x(i) + 2} y={Math.min(cero, y(p.egresos))} width={anchoBarra} height={Math.abs(cero - y(p.egresos))} rx="1" fill="#d63f3f" />}
          <text x={x(i)} y={alto - 16} textAnchor="middle" fontSize="13" fill="#514d46">{anual ? new Date(`${p.fecha}T12:00:00`).toLocaleDateString("es-AR", { month: "short" }).replace(".", "").toUpperCase() : p.fecha.slice(-2)}</text>
          {p.pendiente && <text x={x(i)} y={alto - 2} textAnchor="middle" fontSize="10" fill="#756f67">Pendiente</text>}
        </g>)}
        <path d={linea} fill="none" stroke="#e8b943" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        {puntos.map((p, i) => <g key={p.fecha}>
          {i === indiceSeleccionado && !p.pendiente && <circle cx={x(i)} cy={y(p.neto)} r={i === indiceSeleccionado ? 4.5 : 3} fill={p.neto < 0 ? "#b3453c" : "#b1851a"} stroke="white" strokeWidth="1.5" pointerEvents="none" />}
          <rect x={izquierda + espacio * i} y={arriba} width={espacio} height={alto - arriba - abajo} fill="transparent" role="button" tabIndex={0}
            aria-label={p.pendiente ? `${p.fecha.slice(0, 7)}: mes pendiente` : `${fechaCorta(p.fecha)}: ingresos ${moneda(p.ingresos)}, egresos ${moneda(p.egresos)}, resultado ${moneda(p.neto)}. Ver detalle.`}
            aria-pressed={i === indiceSeleccionado}
            className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-500"
            onMouseEnter={() => setFechaSeleccionada(p.fecha)} onFocus={() => setFechaSeleccionada(p.fecha)} onClick={() => setFechaSeleccionada(p.fecha)}
            onKeyDown={evento => {
              if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); setFechaSeleccionada(p.fecha); }
            }}>
            <title>{`${fechaCorta(p.fecha)} · Ingresos: ${moneda(p.ingresos)} · Egresos: ${moneda(p.egresos)} · Resultado: ${moneda(p.neto)}`}</title>
          </rect>
        </g>)}
      </svg>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-neutral-50 px-4 py-3 text-sm sm:grid-cols-4" aria-label={anual ? "Detalle del mes seleccionado" : "Detalle del día seleccionado"}>
      <div><p className="text-xs text-[#514d46]">{anual ? "Mes seleccionado" : "Día seleccionado"}</p><p className="mt-1 font-medium text-neutral-900">{fechaCompleta}</p></div>
      <div><p className="text-xs text-[#514d46]">Ingresos cobrados</p><p className="mt-1 font-semibold tabular-nums text-[#2d654f]">{seleccionado.pendiente ? "—" : moneda(seleccionado.ingresos)}</p></div>
      <div><p className="text-xs text-[#514d46]">Egresos pagados</p><p className="mt-1 font-semibold tabular-nums text-[#934c3b]">{seleccionado.pendiente ? "—" : moneda(seleccionado.egresos)}</p></div>
      <div><p className="text-xs text-[#514d46]">{estado}</p><p className={`mt-1 font-semibold tabular-nums ${seleccionado.neto < 0 ? "text-red-700" : seleccionado.neto > 0 ? "text-[#2d654f]" : "text-neutral-900"}`}>{seleccionado.pendiente ? "—" : moneda(seleccionado.neto)}</p></div>
    </div>
  </Card>;
}
