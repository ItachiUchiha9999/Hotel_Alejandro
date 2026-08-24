'use client';

import { useEffect, useState } from 'react';

type Movimiento = {
  stock_movement_id: number;
  stock_movement_operation_type: string;
  transaction_date: string;
  observations: string | null;
  employees: {
    employees_name: string;
    employees_lastname: string;
  };
  deposit_stock_movement_deposit_origin_idTodeposit: {
    deposit_name: string;
  } | null;
  deposit_stock_movement_deposit_destination_idTodeposit: {
    deposit_name: string;
  } | null;
  movement_stock_detail: {
    amount: string;
    articles_deposit_stock: {
      articles: { article_name: string };
    } | null;
  }[];
};

const TIPOS = ['', 'INGRESO', 'EGRESO', 'TRANSFERENCIA', 'CONSUMO'];
const CHARCOAL = '#26333B';
const GOLD = '#CBA45C';
const SERIF = 'Georgia, "Times New Roman", serif';

export default function HistorialMovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState('');

  useEffect(() => {
    setCargando(true);
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);

    fetch(`http://localhost:3000/api/stock/movimientos?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener el historial');
        return res.json();
      })
      .then((data) => setMovimientos(data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [tipo]);

  function handleExportar() {
    const params = new URLSearchParams();
    if (tipo) params.set('tipo', tipo);
    window.open(`http://localhost:3000/api/stock/movimientos/exportar?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
          STK-07 · REPORTES · GERENCIA / AUDITORÍA
        </p>
        <h2 className="text-[26px]" style={{ fontFamily: SERIF, color: CHARCOAL }}>
          Historial de movimientos
        </h2>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <p className="text-[13px]" style={{ color: `${CHARCOAL}99` }}>
          Movimientos de stock registrados, ordenados por fecha.
        </p>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.15em]" style={{ color: `${CHARCOAL}80` }}>
              Tipo
            </span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="border text-[13px] px-3 py-2 bg-white"
              style={{ borderColor: `${CHARCOAL}33`, color: CHARCOAL }}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t === '' ? 'Todos' : t}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleExportar}
            className="border text-[11px] uppercase tracking-[0.15em] font-semibold px-4 py-2 transition-colors hover:bg-[#CBA45C] hover:text-white"
            style={{ borderColor: GOLD, color: GOLD }}
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {cargando && (
        <p className="text-[13px]" style={{ color: `${CHARCOAL}99` }}>
          Cargando movimientos…
        </p>
      )}
      {error && <p className="text-[13px] text-[#A5493A]">No se pudo cargar el historial: {error}</p>}
      {!cargando && !error && movimientos.length === 0 && (
        <p className="text-[13px]" style={{ color: `${CHARCOAL}80` }}>
          No hay movimientos para este filtro.
        </p>
      )}

      {!cargando && !error && movimientos.length > 0 && (
        <table className="w-full border-collapse font-sans">
          <thead>
            <tr>
              {['Fecha', 'Tipo', 'Origen', 'Destino', 'Artículo(s)', 'Empleado'].map((h, i) => (
                <th
                  key={h}
                  className={`text-left text-[11px] uppercase tracking-[0.1em] font-normal pb-2 border-b ${
                    i > 0 ? 'pl-6' : ''
                  }`}
                  style={{ color: `${CHARCOAL}80`, borderColor: `${CHARCOAL}33` }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.stock_movement_id} className="border-t" style={{ borderColor: `${CHARCOAL}1F` }}>
                <td className="py-3 text-[13px] whitespace-nowrap" style={{ color: `${CHARCOAL}99` }}>
                  {new Date(m.transaction_date).toLocaleString('es-AR')}
                </td>
                <td className="py-3 pl-6 text-[12px] uppercase tracking-wide" style={{ color: GOLD }}>
                  {m.stock_movement_operation_type}
                </td>
                <td className="py-3 pl-6 text-[14px]" style={{ color: CHARCOAL }}>
                  {m.deposit_stock_movement_deposit_origin_idTodeposit?.deposit_name || '—'}
                </td>
                <td className="py-3 pl-6 text-[14px]" style={{ color: CHARCOAL }}>
                  {m.deposit_stock_movement_deposit_destination_idTodeposit?.deposit_name || '—'}
                </td>
                <td className="py-3 pl-6 text-[14px]" style={{ color: CHARCOAL }}>
                  {m.movement_stock_detail
                    .map((d) => `${d.articles_deposit_stock?.articles?.article_name || '(s/d)'} (${d.amount})`)
                    .join(', ')}
                </td>
                <td className="py-3 pl-6 text-[14px]" style={{ color: `${CHARCOAL}CC` }}>
                  {m.employees.employees_name} {m.employees.employees_lastname}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}