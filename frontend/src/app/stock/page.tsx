'use client';

import { useState, useEffect } from 'react';

interface ArticleStock {
  stock_id: number;
  stock_amount: number;
  articles: {
    article_code: string;
    article_name: string;
    article_unit_of_measure: string;
    categories: {
      category_name: string;
    };
  };
}

export default function StockPage() {
  const [depositId, setDepositId] = useState<number>(1);
  const [stockList, setStockList] = useState<ArticleStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

useEffect(() => {
  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/stock/deposit/${depositId}`);
      
      if (!res.ok) {
        throw new Error(`Error en la petición: status ${res.status}`);
      }

      const result = await res.json();
      if (result.ok) {
        setStockList(result.data);
      }
    } catch (error) {
      console.error('Error conectando al backend:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchStock();
}, [depositId]);

  return (
  <div className="space-y-6">
    {/* ENCABEZADO Y SELECTOR DE DEPÓSITO */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Control de Stock e Inventario</h1>
        <p className="text-sm text-slate-500">Estado de existencias por depósito</p>
      </div>
      
      <div className="flex items-center gap-3">
        <label htmlFor="deposit" className="text-sm font-medium text-slate-700">Depósito:</label>
        <select
          id="deposit"
          value={depositId}
          onChange={(e) => setDepositId(Number(e.target.value))}
          className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none"
        >
          <option value={1}>Depósito Principal (ID 1)</option>
          <option value={2}>Depósito Secundario (ID 2)</option>
        </select>
      </div>
    </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500 text-center">Cargando existencias...</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-gray-600 font-semibold text-sm border-b">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Artículo</th>
                <th className="p-3">Categoría</th>
                <th className="p-3 text-right">Cantidad Disponible</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700 text-sm">
              {stockList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400">
                    No hay artículos cargados en este depósito.
                  </td>
                </tr>
              ) : (
                stockList.map((item) => (
                  <tr key={item.stock_id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium">{item.articles?.article_code}</td>
                    <td className="p-3 font-semibold text-gray-800">{item.articles?.article_name}</td>
                    <td className="p-3 text-gray-500">{item.articles?.categories?.category_name}</td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      {item.stock_amount} {item.articles?.article_unit_of_measure}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}