'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Interfaces alineadas al modelo de Prisma
interface ArticleStock {
  stock_id: number;
  article_id: number;
  deposit_id: number;
  stock_amount: number;
  update_date: string;
  articles: {
    article_code: string;
    article_name: string;
    article_unit_of_measure: string;
    article_stock_min_general: number;
    categories: {
      category_name: string;
    };
  };
  deposit?: {
    deposit_id: number;
    deposit_name: string;
  };
}

interface Deposit {
  deposit_id: number;
  deposit_name: string;
}

export default function StockPage() {
  const [depositId, setDepositId] = useState<number | 'ALL'>('ALL');
  const [depositsList, setDepositsList] = useState<Deposit[]>([]);
  const [stockList, setStockList] = useState<ArticleStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterLowStock, setFilterLowStock] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<ArticleStock | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<string>('Sin registros');

  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showIngresoModal, setShowIngresoModal] = useState<boolean>(false);

  const [transferAmount, setTransferAmount] = useState<number>(1);
  const [targetDepositId, setTargetDepositId] = useState<number>(2);
  const [ingresoAmount, setIngresoAmount] = useState<number>(1);
  const [currentEmployeeId] = useState<number>(1); // ID del empleado en sesión

  // 1. Cargar depósitos activos
  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        const res = await fetch(`${API_URL}/api/depositos`);
        if (res.ok) {
          const result = await res.json();
          if (result.ok && Array.isArray(result.data)) {
            setDepositsList(result.data);
            if (result.data.length > 1) {
              setTargetDepositId(result.data[1].deposit_id);
            }
          }
        }
      } catch (error) {
        setDepositsList([
          { deposit_id: 1, deposit_name: 'Depósito Principal' },
          { deposit_id: 2, deposit_name: 'Depósito Secundario' },
        ]);
      }
    };
    fetchDeposits();
  }, []);

  // 2. Cargar existencias según filtro de depósito
  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      let items: ArticleStock[] = [];

      if (depositId === 'ALL') {
        const activeDeposits =
          depositsList.length > 0
            ? depositsList
            : [{ deposit_id: 1 }, { deposit_id: 2 }];
        const requests = activeDeposits.map((dep) =>
          fetch(`${API_URL}/api/stock/deposito/${dep.deposit_id}`)
            .then((res) => (res.ok ? res.json() : { ok: false, data: [] }))
            .catch(() => ({ ok: false, data: [] }))
        );

        const results = await Promise.all(requests);
        results.forEach((res) => {
          if (res.ok && Array.isArray(res.data)) {
            items = [...items, ...res.data];
          }
        });
      } else {
        const res = await fetch(`${API_URL}/api/stock/deposito/${depositId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.ok) items = result.data;
        }
      }

      const validData = items.map((item) => ({
        ...item,
        stock_amount: Math.max(0, Number(item.stock_amount)),
      }));

      setStockList(validData);
      setSelectedItem(validData.length > 0 ? validData[0] : null);
    } catch (error) {
      console.error('Error al obtener el stock:', error);
    } finally {
      setLoading(false);
    }
  }, [depositId, depositsList]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // 3. Listener para sincronización con la ventana emergente de movimientos
  useEffect(() => {
    const handleStockUpdate = (event: MessageEvent) => {
      if (event.data?.type === 'STOCK_MOVEMENT_UPDATED') {
        fetchStock();
        if (event.data.lastMovementTime) {
          setLastMovementTime(event.data.lastMovementTime);
        }
      }
    };

    window.addEventListener('message', handleStockUpdate);
    return () => window.removeEventListener('message', handleStockUpdate);
  }, [fetchStock]);

  // 3.1 Sincronizar los datos en la pagina principal 
  useEffect(() => {
    // Suscripción mediante BroadcastChannel (funciona entre pestañas/ventanas del mismo origen)
    const channel = new BroadcastChannel('stock_updates');
    channel.onmessage = () => {
      fetchStock();
    };

    // Escucha secundaria para ventanas secundarias abiertas con window.open
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'REFRESH_STOCK') {
        fetchStock();
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      channel.close();
      window.removeEventListener('message', handleMessage);
    };
  }, [fetchStock]);

  // 4. Búsqueda multicriterio (Código, Nombre, Categoría o ID)
  const filteredStock = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return stockList.filter((item) => {
      const codeMatch = item.articles?.article_code?.toLowerCase().includes(term);
      const nameMatch = item.articles?.article_name?.toLowerCase().includes(term);
      const categoryMatch = item.articles?.categories?.category_name?.toLowerCase().includes(term);
      const stockIdMatch = String(item.stock_id).includes(term);

      const matchesSearch = codeMatch || nameMatch || categoryMatch || stockIdMatch;

      const minStockThreshold = Number(item.articles?.article_stock_min_general) || 5;
      const matchesLowStock = filterLowStock ? item.stock_amount <= minStockThreshold : true;

      return matchesSearch && matchesLowStock;
    });
  }, [stockList, searchTerm, filterLowStock]);

  // KPIs
  const totalUnidades = useMemo(() => {
    return filteredStock.reduce((acc, curr) => acc + curr.stock_amount, 0);
  }, [filteredStock]);

  const articulosBajoMinimo = useMemo(() => {
    return filteredStock.filter((item) => {
      const minStockThreshold = Number(item.articles?.article_stock_min_general) || 5;
      return item.stock_amount <= minStockThreshold;
    }).length;
  }, [filteredStock]);

  // Abrir ventana emergente
  const handleRegistrarMovimientoVentana = () => {
    const width = 960;
    const height = 750;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));

    window.open(
      '/stock/movements/new?mode=stock_deposito',
      '_blank',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
  };

  // Exportar CSV
  const handleExportarCSV = () => {
    if (filteredStock.length === 0) return;
    const headers = ['ID Stock', 'Codigo', 'Articulo', 'Categoria', 'Deposito', 'Cantidad', 'Unidad'];
    const rows = filteredStock.map((item) => [
      item.stock_id,
      item.articles?.article_code,
      `"${item.articles?.article_name}"`,
      `"${item.articles?.categories?.category_name || ''}"`,
      `"${item.deposit?.deposit_name || item.deposit_id}"`,
      item.stock_amount,
      item.articles?.article_unit_of_measure,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_stock_${depositId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportarPDF = () => {
    setShowExportMenu(false);
    window.print();
  };

  // Confirmar Transferencia alineada a Prisma
  const handleConfirmarTransferencia = async () => {
    if (!selectedItem || transferAmount <= 0) return;

    if (transferAmount > selectedItem.stock_amount) {
      alert('Error: La cantidad a transferir excede el stock disponible.');
      return;
    }

    const payload = {
      stock_movement_operation_type: 'TRANSFERENCIA',
      article_code: selectedItem.articles.article_code,
      deposit_origin_id: selectedItem.deposit_id,
      deposit_destination_id: targetDepositId,
      employees_id: currentEmployeeId,
      amount: Number(transferAmount),
      observations: 'Transferencia directa desde panel de stock',
    };

    try {
      const res = await fetch(`${API_URL}/api/stock/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Transferencia realizada con éxito.');
        const now = new Date();
        setLastMovementTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        fetchStock();
      } else {
        alert('Error al procesar la transferencia en el servidor.');
      }
    } catch (error) {
      alert('Error de red al conectar con el servidor.');
    } finally {
      setShowTransferModal(false);
    }
  };

  // Confirmar Ingreso alineado a Prisma
  const handleConfirmarIngreso = async () => {
    if (!selectedItem || ingresoAmount <= 0) return;

    const payload = {
      stock_movement_operation_type: 'INGRESO',
      article_code: selectedItem.articles.article_code,
      deposit_origin_id: selectedItem.deposit_id,
      deposit_destination_id: null,
      employees_id: currentEmployeeId,
      amount: Number(ingresoAmount),
      observations: 'Ingreso directo desde panel de stock',
    };

    try {
      const res = await fetch(`${API_URL}/api/stock/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Ingreso registrado con éxito.');
        const now = new Date();
        setLastMovementTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        fetchStock();
      } else {
        alert('Error al registrar el ingreso en el servidor.');
      }
    } catch (error) {
      alert('Error de red al conectar con el servidor.');
    } finally {
      setShowIngresoModal(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col font-sans">
      {/* HEADER PRINCIPAL */}
      <header className="bg-white px-8 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 relative">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
            STK-03 · ENCARGADO DE STOCK
          </span>
          <h2 className="text-3xl font-serif text-[#26333B]">
            {depositId === 'ALL'
              ? 'Stock Consolidado (Todos los Depósitos)'
              : `Stock del Depósito ID ${depositId}`}
          </h2>
        </div>

        <div className="flex items-center gap-5">
          {/* Menu Exportación */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs tracking-wider flex items-center gap-1.5 transition-colors"
            >
              EXPORTAR
              <span className="text-[9px]">▼</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-30 text-xs text-slate-700">
                <button
                  onClick={handleExportarCSV}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  📊 Exportar a CSV
                </button>
                <button
                  onClick={handleExportarPDF}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2 border-t border-slate-100"
                >
                  📄 Exportar a PDF
                </button>
              </div>
            )}
          </div>

          {/* Botón Registrar Movimiento */}
          <button
            onClick={handleRegistrarMovimientoVentana}
            className="px-4 py-2 bg-[#26333B] text-white rounded hover:bg-slate-800 font-medium text-xs tracking-wider transition-all shadow-sm"
          >
            REGISTRAR MOVIMIENTO
          </button>
        </div>
      </header>

      {/* FILTROS Y BÚSQUEDA MULTICRITERIO */}
      <section className="bg-white px-8 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 text-xs">
        <div className="flex items-center gap-3 flex-1 max-w-3xl">
          <select
            id="deposit"
            value={depositId}
            onChange={(e) =>
              setDepositId(
                e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
              )
            }
            className="border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:border-[#CBA45C]"
          >
            <option value="ALL">Todos los depósitos (Consolidado)</option>
            {depositsList.map((dep) => (
              <option key={dep.deposit_id} value={dep.deposit_id}>
                {dep.deposit_name} (ID {dep.deposit_id})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Buscar por código, artículo, categoría o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 flex-1 focus:outline-none focus:border-[#CBA45C]"
          />

          <select
            value={filterLowStock ? 'LOW' : 'ALL'}
            onChange={(e) => setFilterLowStock(e.target.value === 'LOW')}
            className="border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-[#CBA45C]"
          >
            <option value="ALL">Todos los estados</option>
            <option value="LOW">Sólo bajo mínimo</option>
          </select>
        </div>
        <span className="text-slate-400">
          {filteredStock.length} artículos
        </span>
      </section>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col bg-white overflow-y-auto border-r border-slate-200">
          <div className="grid grid-cols-4 border-b border-slate-200 divide-x divide-slate-200 shrink-0">
            <div className="p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                UNIDADES EN DEPÓSITO
              </span>
              <span className="text-2xl font-serif text-[#26333B]">
                {loading ? '...' : totalUnidades}
              </span>
            </div>
            <div className="p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                ARTÍCULOS DISTINTOS
              </span>
              <span className="text-2xl font-serif text-[#26333B]">
                {loading ? '...' : filteredStock.length}
              </span>
            </div>
            <div className="p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                BAJO MÍNIMO
              </span>
              <span className="text-2xl font-serif text-[#CBA45C]">
                {loading ? '...' : articulosBajoMinimo}
              </span>
            </div>
            <div className="p-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                ÚLTIMO MOVIMIENTO
              </span>
              <span className="text-2xl font-serif text-[#26333B]">
                {lastMovementTime}
              </span>
            </div>
          </div>

          {/* TABLA DE STOCK */}
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <p className="p-8 text-center text-slate-400">
                Cargando existencias...
              </p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50">
                    <th className="py-3 px-6">CÓDIGO</th>
                    <th className="py-3 px-4">ARTÍCULO</th>
                    <th className="py-3 px-4">CATEGORÍA</th>
                    <th className="py-3 px-4 text-right">CANT. DISPONIBLE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-400"
                      >
                        No hay artículos registrados para la consulta.
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item) => (
                      <tr
                        key={item.stock_id}
                        onClick={() => setSelectedItem(item)}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedItem?.stock_id === item.stock_id
                            ? 'bg-slate-50 font-medium'
                            : ''
                          }`}
                      >
                        <td className="py-3.5 px-6 font-mono text-slate-500">
                          {item.articles?.article_code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {item.articles?.article_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {item.articles?.categories?.category_name || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {item.stock_amount}{' '}
                          <span className="text-slate-400 font-normal">
                            {item.articles?.article_unit_of_measure}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400 shrink-0">
            <span>
              Mostrando {filteredStock.length} de {stockList.length}
            </span>
            <span>
              Saldo total:{' '}
              <strong className="text-slate-800">{totalUnidades}</strong>
            </span>
          </div>
        </main>

        {/* DETALLE LATERAL */}
        <aside className="w-80 bg-white flex flex-col justify-between shrink-0 overflow-y-auto border-l border-slate-200">
          {selectedItem ? (
            <div className="p-6">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                DETALLE · {selectedItem.articles?.article_code}
              </span>
              <h3 className="text-xl font-serif text-[#26333B] mb-6">
                {selectedItem.articles?.article_name}
              </h3>

              <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-4 mb-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    EXISTENCIA
                  </span>
                  <span className="text-3xl font-serif text-[#26333B]">
                    {selectedItem.stock_amount}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    U. MEDIDA
                  </span>
                  <span className="text-lg font-serif text-slate-600 mt-1 block">
                    {selectedItem.articles?.article_unit_of_measure}
                  </span>
                </div>
              </div>

              <div className="bg-[#FAF6F0] border border-[#CBA45C]/40 rounded p-4 mb-6 text-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#CBA45C] block mb-1">
                  ESTADO DEL INVENTARIO
                </span>
                <p className="text-xs leading-relaxed">
                  Categoría:{' '}
                  {selectedItem.articles?.categories?.category_name ||
                    'Sin asignación'}
                </p>
                <p className="text-xs leading-relaxed mt-1 font-medium">
                  {selectedItem.stock_amount <= (Number(selectedItem.articles?.article_stock_min_general) || 5)
                    ? '⚠️ Alerta: Stock bajo el nivel recomendado.'
                    : '✅ Nivel de stock adecuado.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-slate-400 text-xs text-center">
              Selecciona un artículo para ver su detalle
            </div>
          )}

          <div className="p-4 border-t border-slate-200 flex gap-2 shrink-0">
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={!selectedItem}
              className="flex-1 py-2 border border-slate-300 rounded text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs disabled:opacity-50"
            >
              Transferir
            </button>
            <button
              onClick={() => setShowIngresoModal(true)}
              disabled={!selectedItem}
              className="flex-1 py-2 bg-[#26333B] text-white rounded hover:bg-slate-800 font-medium text-xs disabled:opacity-50"
            >
              Registrar ingreso
            </button>
          </div>
        </aside>
      </div>

      {/* MODAL TRANSFERENCIA */}
      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 font-sans">
            <h3 className="text-lg font-serif text-[#26333B] mb-2">
              Transferir Insumo
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Artículo: {selectedItem.articles?.article_name} (Disponible:{' '}
              {selectedItem.stock_amount})
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 mb-1">
                  Depósito Destino
                </label>
                <select
                  value={targetDepositId}
                  onChange={(e) => setTargetDepositId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-[#CBA45C]"
                >
                  {depositsList
                    .filter((dep) => dep.deposit_id !== selectedItem.deposit_id)
                    .map((dep) => (
                      <option key={dep.deposit_id} value={dep.deposit_id}>
                        {dep.deposit_name} (ID {dep.deposit_id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">
                  Cantidad a Transferir
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem.stock_amount}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-[#CBA45C]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarTransferencia}
                className="px-3 py-1.5 bg-[#26333B] text-white rounded text-xs hover:bg-slate-800"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INGRESO */}
      {showIngresoModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96 font-sans">
            <h3 className="text-lg font-serif text-[#26333B] mb-2">
              Registrar Ingreso de Stock
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Artículo: {selectedItem.articles?.article_name}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 mb-1">
                  Cantidad Ingresante
                </label>
                <input
                  type="number"
                  min={1}
                  value={ingresoAmount}
                  onChange={(e) => setIngresoAmount(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded p-2 focus:outline-none focus:border-[#CBA45C]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowIngresoModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarIngreso}
                className="px-3 py-1.5 bg-[#26333B] text-white rounded text-xs hover:bg-slate-800"
              >
                Ingresar Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}