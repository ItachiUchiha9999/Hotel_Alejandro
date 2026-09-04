'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

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
    article_state?: boolean;
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

interface AppliedRow {
  article_name: string;
  before: number;
  moved: number;
  after: number;
}

type StockMap = Record<number, StockRow[]>;

const amountIn = (map: StockMap, depositId: number | null, articleId: number) =>
  depositId === null
    ? 0
    : (map[depositId] ?? []).find((r) => r.article_id === articleId)?.stock_amount ?? 0;

export default function TransfersPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [stockByDeposit, setStockByDeposit] = useState<StockMap>({});
  const [originId, setOriginId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickArticle, setPickArticle] = useState<string>('');
  const [pickAmount, setPickAmount] = useState<number>(1);
  const [observations, setObservations] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [applied, setApplied] = useState<{ depositName: string; rows: AppliedRow[] } | null>(null);

  const loadAll = useCallback(async (): Promise<StockMap> => {
    setLoading(true);
    const byDeposit: StockMap = {};
    let list: Deposit[] = [];

    try {
      const resDep = await fetch(`${API}/api/depositos?activos=true`);
      const jsonDep = await resDep.json();
      list = jsonDep?.data ?? [];
    } catch {
      /* backend caído */
    }

    await Promise.all(
      list.map(async (d) => {
        try {
          const res = await fetch(`${API}/api/stock/deposito/${d.deposit_id}`);
          if (!res.ok) return;
          const json = await res.json();
          if (!json.ok || !Array.isArray(json.data)) return;
          byDeposit[d.deposit_id] = json.data.map((r: StockRow) => ({
            ...r,
            stock_amount: Number(r.stock_amount),
            articles: {
              ...r.articles,
              article_state: r.articles?.article_state ?? true,
            },
          }));
        } catch {
          /* depósito sin stock */
        }
      })
    );

    list.sort((a, b) => a.deposit_id - b.deposit_id);
    setDeposits(list);
    setStockByDeposit(byDeposit);

    if (list.length > 0) {
      setOriginId((prev) => prev ?? list[0].deposit_id);
      setTargetId((prev) => prev ?? list[1]?.deposit_id ?? list[0].deposit_id);
    }
    setLoading(false);
    return byDeposit;
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const depositName = (id: number | null) =>
    deposits.find((d) => d.deposit_id === id)?.deposit_name ?? '—';

  const depositTotal = (id: number | null) =>
    id === null ? 0 : (stockByDeposit[id] ?? []).reduce((s, r) => s + r.stock_amount, 0);

  // Solo artículos con stock disponible que NO estén dados de baja
  const originStock = useMemo(() => {
    if (originId === null) return [];
    return (stockByDeposit[originId] ?? []).filter(
      (r) => Number(r.stock_amount) > 0 && r.articles?.article_state !== false
    );
  }, [originId, stockByDeposit]);

  useEffect(() => {
    setLines([]);
    setResult(null);
    setApplied(null);
    setPickArticle(originStock[0] ? String(originStock[0].article_id) : '');
  }, [originId, targetId, originStock]);

  const selectedArticleRow = useMemo(() => {
    return originStock.find((r) => r.article_id === Number(pickArticle));
  }, [originStock, pickArticle]);

  const alreadyInLinesAmount = useMemo(() => {
    const line = lines.find((l) => l.article_id === Number(pickArticle));
    return line ? line.amount : 0;
  }, [lines, pickArticle]);

  const availableToAdd = useMemo(() => {
    if (!selectedArticleRow) return 0;
    return Math.max(0, selectedArticleRow.stock_amount - alreadyInLinesAmount);
  }, [selectedArticleRow, alreadyInLinesAmount]);

  const isPickAmountValid =
    Boolean(selectedArticleRow) &&
    Number.isInteger(pickAmount) &&
    pickAmount > 0 &&
    pickAmount <= availableToAdd;

  const addLine = () => {
    if (!selectedArticleRow || !isPickAmountValid) return;

    const existingIndex = lines.findIndex((l) => l.article_id === selectedArticleRow.article_id);

    if (existingIndex >= 0) {
      setLines(
        lines.map((l, i) =>
          i === existingIndex ? { ...l, amount: l.amount + pickAmount } : l
        )
      );
    } else {
      setLines([
        ...lines,
        {
          article_id: selectedArticleRow.article_id,
          article_code: selectedArticleRow.articles.article_code,
          article_name: selectedArticleRow.articles.article_name,
          unit: selectedArticleRow.articles.article_unit_of_measure,
          available: selectedArticleRow.stock_amount,
          amount: pickAmount,
        },
      ]);
    }

    setPickAmount(1);
    setApplied(null);
  };

  const removeLine = (id: number) => setLines(lines.filter((l) => l.article_id !== id));

  const setLineAmount = (id: number, amount: number) =>
    setLines(lines.map((l) => (l.article_id === id ? { ...l, amount } : l)));

  const problems: string[] = [];
  if (originId !== null && originId === targetId) {
    problems.push('El depósito de origen y el de destino deben ser distintos.');
  }
  for (const l of lines) {
    if (!Number.isInteger(l.amount) || l.amount <= 0) {
      problems.push(`${l.article_name}: la cantidad debe ser un número entero mayor a cero.`);
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
    setApplied(null);

    const beforeMap = stockByDeposit;
    const sent = [...lines];
    const destName = depositName(targetId);

    const failed: string[] = [];
    for (const l of sent) {
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

    const freshMap = await loadAll();

    setApplied({
      depositName: destName,
      rows: sent.map((l) => ({
        article_name: l.article_name,
        before: amountIn(beforeMap, targetId, l.article_id),
        moved: l.amount,
        after: amountIn(freshMap, targetId, l.article_id),
      })),
    });

    if (failed.length === 0) {
      setResult({
        ok: true,
        text: `Transferencia registrada: ${sent.length} línea(s), ${totalUnits} unidades.`,
      });
      setLines([]);
    } else {
      setResult({ ok: false, text: failed.join(' · ') });
    }

    setSaving(false);
  };

  const label = 'text-[10px] uppercase font-bold tracking-wider text-slate-400';

  return (
    <div className="-m-8 bg-white min-h-[calc(100vh-73px)] flex flex-col">
      <header className="px-8 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <span className={`${label} block mb-0.5`}></span>
          <h2 className="text-3xl font-serif text-[#26333B]">Transferencia entre depósitos</h2>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => {
              setLines([]);
              setResult(null);
              setApplied(null);
            }}
            className="px-4 py-2 border border-slate-300 rounded text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium tracking-wider cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="px-4 py-2 bg-[#26333B] text-white rounded hover:bg-slate-800 text-xs font-medium tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'REGISTRANDO…' : 'CONFIRMAR TRANSFERENCIA'}
          </button>
        </div>
      </header>

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

      <div className="flex-1 grid grid-cols-[1fr_380px]">
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
                        min={1}
                        max={l.available}
                        step={1}
                        value={l.amount}
                        onChange={(e) => setLineAmount(l.article_id, Number(e.target.value))}
                        className={`w-20 border rounded px-2 py-1 text-right font-mono focus:outline-none ${
                          remaining < 0
                            ? 'border-red-500 focus:border-red-600 bg-red-50 text-red-700'
                            : 'border-slate-300 focus:border-[#CBA45C]'
                        }`}
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
                        className="text-slate-400 hover:text-red-600 text-base leading-none cursor-pointer"
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
              onChange={(e) => {
                setPickArticle(e.target.value);
                setPickAmount(1);
              }}
              disabled={originStock.length === 0}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#CBA45C] disabled:bg-slate-100 cursor-pointer"
            >
              {originStock.length === 0 ? (
                <option value="">No hay artículos disponibles para transferir</option>
              ) : (
                originStock.map((r) => {
                  const enTabla = lines.find((l) => l.article_id === r.article_id)?.amount ?? 0;
                  const disponible = Math.max(0, r.stock_amount - enTabla);
                  return (
                    <option key={r.article_id} value={r.article_id}>
                      {r.articles.article_code} · {r.articles.article_name} (Stock: {r.stock_amount}
                      {enTabla > 0 ? ` | Disponible: ${disponible}` : ''})
                    </option>
                  );
                })
              )}
            </select>

            <input
              type="number"
              min={1}
              max={availableToAdd}
              step={1}
              value={pickAmount}
              onChange={(e) => setPickAmount(Number(e.target.value))}
              disabled={originStock.length === 0 || availableToAdd === 0}
              aria-label="Cantidad"
              className={`w-24 border rounded px-3 py-2 text-xs text-right font-mono focus:outline-none disabled:bg-slate-100 ${
                !isPickAmountValid && availableToAdd > 0
                  ? 'border-red-400 text-red-600 bg-red-50 focus:border-red-500'
                  : 'border-slate-300 focus:border-[#CBA45C]'
              }`}
            />

            <button
              onClick={addLine}
              disabled={!isPickAmountValid}
              className="px-4 py-2 border border-[#CBA45C] text-[#8C7136] rounded text-xs font-medium hover:bg-[#FAF6F0] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {availableToAdd === 0 && selectedArticleRow ? 'Sin stock disponible' : 'Agregar Articulo(s)'}
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

        <aside className="p-6 flex flex-col">
          <h3 className="font-serif text-xl text-[#26333B] mb-5">Resultado de la operación</h3>

          {lines.length > 0 && (
            <div className="mt-6">
              <span className={`${label} block mb-2`}>En {depositName(targetId)} quedará</span>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="text-left font-bold py-1.5">Artículo</th>
                    <th className="text-right font-bold py-1.5">Ahora</th>
                    <th className="text-right font-bold py-1.5">Suma</th>
                    <th className="text-right font-bold py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l) => {
                    const before = amountIn(stockByDeposit, targetId, l.article_id);
                    return (
                      <tr key={l.article_id}>
                        <td className="py-2 pr-2 text-slate-700">{l.article_name}</td>
                        <td className="py-2 text-right font-mono text-slate-400">{before}</td>
                        <td className="py-2 text-right font-mono text-[#8C7136]">+{l.amount}</td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">
                          {before + l.amount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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
              <p className={`text-xs ${result.ok ? 'text-green-800' : 'text-red-800'}`}>
                {result.text}
              </p>
            </div>
          )}

          {applied && (
            <div className="mt-5">
              <span className={`${label} block mb-2`}>Quedó en {applied.depositName}</span>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="text-left font-bold py-1.5">Artículo</th>
                    <th className="text-right font-bold py-1.5">Antes</th>
                    <th className="text-right font-bold py-1.5">Movido</th>
                    <th className="text-right font-bold py-1.5">Ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {applied.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-2 text-slate-700">{r.article_name}</td>
                      <td className="py-2 text-right font-mono text-slate-400">{r.before}</td>
                      <td className="py-2 text-right font-mono text-[#8C7136]">+{r.moved}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">{r.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-2">
                Valores leídos de la base después de registrar el movimiento.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}