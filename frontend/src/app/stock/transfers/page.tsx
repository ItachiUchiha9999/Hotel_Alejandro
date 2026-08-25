'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Deposit {
  deposit_id: number;
  deposit_name: string;
  deposit_location?: string;
}

interface StockRow {
  stock_id: number;
  article_id: number;
  deposit_id: number;
  stock_amount: number;
  articles: {
    article_code: string;
    article_name: string;
    article_unit_of_measure: string;
  };
  deposit?: Deposit;
}

interface Line {
  article_id: number;
  article_code: string;
  article_name: string;
  unit: string;
  available: number;
  amount: number;
}

export default function TransfersPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [stockByDeposit, setStockByDeposit] = useState<Record<number, StockRow[]>>({});
  const [originId, setOriginId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickArticle, setPickArticle] = useState<string>('');
  const [pickAmount, setPickAmount] = useState<number>(1);
  const [observations, setObservations] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Carga inicial: recorre los depósitos conocidos y arma la lista a partir del stock.
  // Los depósitos salen de GET /api/depositos. Antes se tanteaban a ciegas
  // los ids del 1 al 6 porque ese endpoint no existía.
  const loadAll = useCallback(async () => {
    setLoading(true);
    const found: Deposit[] = [];
    const byDeposit: Record<number, StockRow[]> = {};

    let ids: number[] = [];
    try {
      const resDep = await fetch(`${API}/api/depositos?activos=true`);
      const jsonDep = await resDep.json();
      ids = (jsonDep?.data ?? []).map((d: Deposit) => d.deposit_id);
    } catch {
      /* backend caído: la pantalla queda vacía y avisa */
    }

    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`${API}/api/stock/deposito/${id}`);
          if (!res.ok) return;
          const json = await res.json();
          if (!json.ok || !Array.isArray(json.data)) return;

          const rows: StockRow[] = json.data.map((r: StockRow) => ({
            ...r,
            stock_amount: Number(r.stock_amount),
          }));
          byDeposit[id] = rows;

          const dep = rows[0]?.deposit;
          if (dep) found.push(dep);
        } catch {
          /* depósito inexistente o backend caído */
        }
      })
    );

    found.sort((a, b) => a.deposit_id - b.deposit_id);
    setDeposits(found);
    setStockByDeposit(byDeposit);
    if (found.length > 0) {
      setOriginId((prev) => prev ?? found[0].deposit_id);
      setTargetId((prev) => prev ?? found[1]?.deposit_id ?? found[0].deposit_id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const depositName = (id: number | null) =>
    deposits.find((d) => d.deposit_id === id)?.deposit_name ?? '—';

  const depositTotal = (id: number | null) =>
    id === null ? 0 : (stockByDeposit[id] ?? []).reduce((s, r) => s + r.stock_amount, 0);

  const originStock = originId === null ? [] : (stockByDeposit[originId] ?? []).filter((r) => r.stock_amount > 0);

  // Al cambiar de depósito, las líneas dejan de ser válidas.
  useEffect(() => {
    setLines([]);
    setResult(null);
    setPickArticle(originStock[0] ? String(originStock[0].article_id) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originId, targetId]);

  const addLine = () => {
    const row = originStock.find((r) => r.article_id === Number(pickArticle));
    if (!row) return;
    if (lines.some((l) => l.article_id === row.article_id)) return;
    setLines([
      ...lines,
      {
        article_id: row.article_id,
        article_code: row.articles.article_code,
        article_name: row.articles.article_name,
        unit: row.articles.article_unit_of_measure,
        available: row.stock_amount,
        amount: pickAmount,
      },
    ]);
    setPickAmount(1);
  };

  const removeLine = (id: number) => setLines(lines.filter((l) => l.article_id !== id));

  const setLineAmount = (id: number, amount: number) =>
    setLines(lines.map((l) => (l.article_id === id ? { ...l, amount } : l)));

  // Validaciones espejo de las del backend
  const problems: string[] = [];
  if (originId !== null && originId === targetId) {
    problems.push('El depósito de origen y el de destino deben ser distintos.');
  }
  for (const l of lines) {
    if (l.amount <= 0) {
      problems.push(`${l.article_name}: la cantidad debe ser mayor a cero.`);
    } else if (l.amount > l.available) {
      problems.push(
        `${l.article_name}: se intentan transferir ${l.amount} y el origen tiene ${l.available} disponibles.`
      );
    }
  }

  const totalUnits = lines.reduce((s, l) => s + l.amount, 0);
  const canConfirm = lines.length > 0 && problems.length === 0 && !saving;

  const confirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setResult(null);

    const failed: string[] = [];
    for (const l of lines) {
      try {
        const res = await fetch(`${API}/api/stock/movimientos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_movement_operation_type: 'TRANSFERENCIA',
            article_code: l.article_code,
            deposit_origin_id: originId,
            deposit_destination_id: targetId,
            amount: l.amount,
            observations: observations.trim() || null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) failed.push(`${l.article_name}: ${json.message ?? 'error del servidor'}`);
      } catch {
        failed.push(`${l.article_name}: no se pudo conectar con el servidor.`);
      }
    }

    if (failed.length === 0) {
      setResult({
        ok: true,
        text: `Transferencia registrada: ${lines.length} línea(s), ${totalUnits} unidades.`,
      });
      setLines([]);
    } else {
      setResult({ ok: false, text: failed.join(' · ') });
    }

    await loadAll();
    setSaving(false);
  };

  const label = 'text-[10px] uppercase font-bold tracking-wider text-slate-400';

  return (
    <div className="-m-8 bg-white min-h-[calc(100vh-73px)] flex flex-col">
      {/* Cabecera */}
      <header className="px-8 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <span className={`${label} block mb-0.5`}>STK-06 · Encargado de stock</span>
          <h2 className="text-3xl font-serif text-[#26333B]">Transferencia entre depósitos</h2>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => {
              setLines([]);
              setResult(null);
            }}
            className="px-4 py-2 border border-slate-300 rounded text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium tracking-wider"
          >
            CANCELAR
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="px-4 py-2 bg-[#26333B] text-white rounded hover:bg-slate-800 text-xs font-medium tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'REGISTRANDO…' : 'CONFIRMAR TRANSFERENCIA'}
          </button>
        </div>
      </header>

      {/* Origen y destino */}
      <section className="px-8 py-5 border-b border-slate-200 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="border border-[#CBA45C] rounded p-4">
          <span className={`${label} block mb-1`}>Origen</span>
          <select
            value={originId ?? ''}
            onChange={(e) => setOriginId(Number(e.target.value))}
            disabled={loading}
            className="w-full text-2xl font-serif text-[#26333B] bg-transparent focus:outline-none cursor-pointer"
          >
            {deposits.map((d) => (
              <option key={d.deposit_id} value={d.deposit_id}>
                {d.deposit_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {depositName(originId) !== '—' &&
              `${deposits.find((d) => d.deposit_id === originId)?.deposit_location ?? ''} · ${depositTotal(originId)} u`}
          </span>
        </div>

        <span className="text-2xl text-[#CBA45C]">→</span>

        <div className="border border-slate-300 rounded p-4">
          <span className={`${label} block mb-1`}>Destino</span>
          <select
            value={targetId ?? ''}
            onChange={(e) => setTargetId(Number(e.target.value))}
            disabled={loading}
            className="w-full text-2xl font-serif text-[#26333B] bg-transparent focus:outline-none cursor-pointer"
          >
            {deposits.map((d) => (
              <option key={d.deposit_id} value={d.deposit_id}>
                {d.deposit_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {depositName(targetId) !== '—' &&
              `${deposits.find((d) => d.deposit_id === targetId)?.deposit_location ?? ''} · ${depositTotal(targetId)} u`}
          </span>
        </div>
      </section>

      {/* Cuerpo */}
      <div className="flex-1 grid grid-cols-[1fr_380px]">
        {/* Líneas */}
        <div className="border-r border-slate-200 flex flex-col">
          <div className="px-8 py-3 bg-slate-50 border-b border-slate-200 flex items-baseline justify-between">
            <h3 className="font-serif text-lg text-[#26333B]">Artículos a transferir</h3>
            <span className="text-xs text-slate-500">
              {lines.length > 0
                ? `${lines.length} línea${lines.length > 1 ? 's' : ''} · ${totalUnits} unidades`
                : 'Sin líneas'}
            </span>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className={`${label} border-b border-slate-200`}>
                <th className="py-2.5 px-8 font-bold">Artículo</th>
                <th className="py-2.5 px-3 text-right font-bold">Disp. origen</th>
                <th className="py-2.5 px-3 text-right font-bold">Cant.</th>
                <th className="py-2.5 px-3 text-right font-bold">Queda</th>
                <th className="py-2.5 px-6" />
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {lines.map((l) => {
                const remaining = l.available - l.amount;
                return (
                  <tr key={l.article_id}>
                    <td className="py-3 px-8">
                      <span className="font-mono text-slate-400">{l.article_code}</span>{' '}
                      <span className="font-medium text-slate-800">{l.article_name}</span>{' '}
                      <span className="text-slate-400">· {l.unit}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{l.available}</td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={l.amount}
                        onChange={(e) => setLineAmount(l.article_id, Number(e.target.value))}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-right font-mono focus:outline-none focus:border-[#CBA45C]"
                      />
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono ${
                        remaining < 0 ? 'text-red-600 font-bold' : 'text-slate-800'
                      }`}
                    >
                      {remaining}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => removeLine(l.article_id)}
                        aria-label={`Quitar ${l.article_name}`}
                        className="text-slate-400 hover:text-red-600 text-base leading-none"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {lines.length === 0 && (
            <p className="px-8 py-6 text-xs text-slate-400 italic">
              {loading
                ? 'Cargando depósitos…'
                : 'Elegí un artículo del depósito de origen y agregá la primera línea.'}
            </p>
          )}

          <div className="px-8 py-4 flex gap-3 border-t border-slate-100">
            <select
              value={pickArticle}
              onChange={(e) => setPickArticle(e.target.value)}
              disabled={originStock.length === 0}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#CBA45C] disabled:bg-slate-100"
            >
              {originStock.length === 0 ? (
                <option value="">El origen no tiene artículos con stock</option>
              ) : (
                originStock.map((r) => (
                  <option key={r.article_id} value={r.article_id}>
                    {r.articles.article_code} · {r.articles.article_name} ({r.stock_amount})
                  </option>
                ))
              )}
            </select>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={pickAmount}
              onChange={(e) => setPickAmount(Number(e.target.value))}
              aria-label="Cantidad"
              className="w-24 border border-slate-300 rounded px-3 py-2 text-xs text-right font-mono focus:outline-none focus:border-[#CBA45C]"
            />
            <button
              onClick={addLine}
              disabled={originStock.length === 0}
              className="px-4 py-2 border border-[#CBA45C] text-[#8C7136] rounded text-xs font-medium hover:bg-[#FAF6F0] disabled:opacity-40"
            >
              Agregar línea
            </button>
          </div>

          <div className="px-8 pb-5">
            <label className={`${label} block mb-1`} htmlFor="obs">
              Observaciones
            </label>
            <input
              id="obs"
              type="text"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Remito, motivo del traslado…"
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#CBA45C]"
            />
          </div>

          <p className="mt-auto px-8 py-4 border-t border-slate-200 text-xs text-slate-400">
            La transferencia se registra como un único movimiento con dos asientos vinculados.
          </p>
        </div>

        {/* Resultado */}
        <aside className="p-6 flex flex-col">
          <h3 className="font-serif text-xl text-[#26333B] mb-5">Resultado de la operación</h3>

          <div className="flex justify-between items-baseline py-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">{depositName(originId)} quedará en</span>
            <span className="text-2xl font-serif text-[#26333B]">
              {lines.length > 0 ? depositTotal(originId) - totalUnits : '—'}
            </span>
          </div>
          <div className="flex justify-between items-baseline py-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">{depositName(targetId)} quedará en</span>
            <span className="text-2xl font-serif text-[#26333B]">
              {lines.length > 0 ? depositTotal(targetId) + totalUnits : '—'}
            </span>
          </div>
          <div className="flex justify-between items-baseline py-3 border-b border-slate-100">
            <span className="text-xs text-slate-500">Total consolidado</span>
            <span className="text-lg font-serif text-slate-500">sin cambios</span>
          </div>

          {problems.length > 0 && (
            <div className="mt-5 border border-red-200 bg-red-50 rounded p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-700 block mb-1">
                No se puede confirmar
              </span>
              <ul className="text-xs text-red-800 space-y-1">
                {problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div
              className={`mt-5 border rounded p-4 ${
                result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold tracking-wider block mb-1 ${
                  result.ok ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {result.ok ? 'Registrada' : 'Rechazada por el servidor'}
              </span>
              <p className={`text-xs ${result.ok ? 'text-green-800' : 'text-red-800'}`}>{result.text}</p>
            </div>
          )}

          <span className={`${label} block mt-8 mb-2`}>Validaciones</span>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li>El origen y el destino deben ser distintos.</li>
            <li>Cada cantidad debe ser mayor a cero.</li>
            <li>El origen debe tener stock suficiente de cada artículo.</li>
            <li>Ambos depósitos deben estar activos.</li>
          </ul>

          <p className="mt-auto pt-6 text-xs text-slate-400">
            Origen y destino deben ser distintos y estar activos.
          </p>
        </aside>
      </div>
    </div>
  );
}