'use client';

import { useEffect, useMemo, useState } from 'react';

type Articulo = {
  stock_amount: string;
  articles: {
    article_code: string;
    article_name: string;
    article_unit_of_measure: string;
  };
  deposit: {
    deposit_name: string;
  };
};

const CHARCOAL = '#26333B';
const GOLD = '#CBA45C';
const SERIF = 'Georgia, "Times New Roman", serif';

export default function SaldoConsolidadoPage() {
  const [datos, setDatos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depositoFiltro, setDepositoFiltro] = useState('');

  useEffect(() => {
    fetch('http://localhost:3000/api/stock')
      .then((res) => {
        if (!res.ok) throw new Error('Error al obtener el stock');
        return res.json();
      })
      .then((data) => setDatos(data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  const porDeposito = useMemo(() => {
    return datos.reduce<Record<string, Articulo[]>>((acc, item) => {
      const nombre = item.deposit.deposit_name;
      if (!acc[nombre]) acc[nombre] = [];
      acc[nombre].push(item);
      return acc;
    }, {});
  }, [datos]);

  const nombresDepositos = useMemo(
    () => Object.keys(porDeposito).sort((a, b) => a.localeCompare(b)),
    [porDeposito]
  );

  const entradasFiltradas = useMemo(() => {
    const entradas = Object.entries(porDeposito);
    if (!depositoFiltro) return entradas;
    return entradas.filter(([nombre]) => nombre === depositoFiltro);
  }, [porDeposito, depositoFiltro]);

  const totalUnidades = datos.reduce((sum, a) => sum + Number(a.stock_amount), 0);

  return (
    <div>
      <div className="mb-6">
        <p style={{ color: GOLD }} className="text-[11px] uppercase tracking-[0.2em] mb-2">
          STK-07 · REPORTES · GERENCIA / AUDITORÍA
        </p>
        <h2 style={{ fontFamily: SERIF, color: CHARCOAL }} className="text-[26px]">
          Reporte consolidado de stock
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.15em]" style={{ color: `${CHARCOAL}80` }}>
            Depósito
          </span>
          <select
            value={depositoFiltro}
            onChange={(e) => setDepositoFiltro(e.target.value)}
            className="border text-[13px] px-3 py-2 bg-white"
            style={{ borderColor: `${CHARCOAL}33`, color: CHARCOAL }}
          >
            <option value="">Todos los depósitos</option>
            {nombresDepositos.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        {!cargando && !error && (
          <p className="text-[13px]" style={{ color: CHARCOAL }}>
            {entradasFiltradas.length} depósito{entradasFiltradas.length !== 1 ? 's' : ''} ·{' '}
            <strong>{totalUnidades.toLocaleString('es-AR')}</strong> unidades totales
          </p>
        )}
      </div>

      {cargando && (
        <p className="text-[13px]" style={{ color: `${CHARCOAL}99` }}>
          Cargando existencias…
        </p>
      )}
      {error && <p className="text-[13px] text-[#A5493A]">No se pudo cargar el stock: {error}</p>}
      {!cargando && !error && entradasFiltradas.length === 0 && (
        <p className="text-[13px]" style={{ color: `${CHARCOAL}80` }}>
          No hay artículos para este depósito.
        </p>
      )}

      {!cargando &&
        !error &&
        entradasFiltradas.map(([deposito, articulos]) => (
          <section key={deposito} className="mb-12">
            <h3
              style={{ fontFamily: SERIF, color: GOLD, borderColor: `${CHARCOAL}26` }}
              className="text-[16px] uppercase tracking-[0.15em] mb-3 pb-2 border-b"
            >
              {deposito}
            </h3>
            <table className="w-full border-collapse font-sans">
              <thead>
                <tr>
                  <th className="text-left text-[11px] uppercase tracking-[0.1em] font-normal pb-2" style={{ color: `${CHARCOAL}80` }}>
                    Código
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-[0.1em] font-normal pb-2" style={{ color: `${CHARCOAL}80` }}>
                    Artículo
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-[0.1em] font-normal pb-2" style={{ color: `${CHARCOAL}80` }}>
                    Cantidad
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-[0.1em] font-normal pb-2 pl-4" style={{ color: `${CHARCOAL}80` }}>
                    Unidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {articulos.map((a, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: `${CHARCOAL}1F` }}>
                    <td className="py-3 text-[13px]" style={{ color: `${CHARCOAL}99` }}>
                      {a.articles.article_code}
                    </td>
                    <td className="py-3 text-[14px]" style={{ color: CHARCOAL }}>
                      {a.articles.article_name}
                    </td>
                    <td className="py-3 text-[14px] text-right tabular-nums" style={{ color: CHARCOAL }}>
                      {a.stock_amount}
                    </td>
                    <td className="py-3 text-[12px] uppercase tracking-wide pl-4" style={{ color: `${CHARCOAL}80` }}>
                      {a.articles.article_unit_of_measure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
    </div>
  );
}