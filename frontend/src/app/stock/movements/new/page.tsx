'use client';

import { useState, useEffect } from 'react';

type MovementType = 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' | 'AJUSTE';

interface Deposit {
  deposit_id: number;
  deposit_name: string;
}

export default function NewMovementPage() {
  const [type, setType] = useState<MovementType>('INGRESO');
  const [articleCode, setArticleCode] = useState('');
  const [originDeposit, setOriginDeposit] = useState<string>('');
  const [targetDeposit, setTargetDeposit] = useState<string>('');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(true);

  // Cargar lista de depósitos disponibles con Fallback de resguardo
  useEffect(() => {
    const fetchDeposits = async () => {
      setIsLoadingDeposits(true);
      
      // Depósitos base para asegurar opciones si la API de Express/Prisma falla
      const defaultDeposits: Deposit[] = [
        { deposit_id: 1, deposit_name: 'Depósito Principal (ID 1)' },
        { deposit_id: 2, deposit_name: 'Depósito Secundario (ID 2)' },
      ];

      try {
        const res = await fetch('http://localhost:4000/api/deposits');
        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data) ? data : data.data || [];

          if (rawList.length > 0) {
            // Normaliza las propiedades para asegurar match con deposit_id y deposit_name
            const normalizedList: Deposit[] = rawList.map((item: any, index: number) => ({
              deposit_id: Number(item.deposit_id ?? item.id ?? index + 1),
              deposit_name: String(item.deposit_name ?? item.name ?? item.descripcion ?? `Depósito ${item.deposit_id ?? index + 1}`)
            }));

            setDeposits(normalizedList);
            setOriginDeposit(String(normalizedList[0].deposit_id));
            setTargetDeposit(String(normalizedList[1]?.deposit_id || normalizedList[0].deposit_id));
            setIsLoadingDeposits(false);
            return;
          }
        }
      } catch (err) {
        console.warn('No se pudo obtener la lista de depósitos del servidor, usando defaults.', err);
      }

      // Si falla la API o no devuelve datos, aplica la lista por defecto
      setDeposits(defaultDeposits);
      setOriginDeposit('1');
      setTargetDeposit('2');
      setIsLoadingDeposits(false);
    };

    fetchDeposits();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleCode.trim() || quantity <= 0) {
      alert('Por favor complete el código del artículo y una cantidad válida.');
      return;
    }

    if (type === 'TRANSFERENCIA' && originDeposit === targetDeposit) {
      alert('El depósito de origen y destino deben ser diferentes.');
      return;
    }

    setIsSubmitting(true);

    const prismaPayload = {
      stock_movement_operation_type: type,
      article_code: articleCode.trim(),
      deposit_origin_id: type !== 'INGRESO' ? Number(originDeposit) : null,
      deposit_destination_id: type !== 'EGRESO' ? Number(targetDeposit) : null,
      amount: Number(quantity),
      observations: observation.trim() || null,
    };

    try {
      const response = await fetch('http://localhost:4000/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prismaPayload),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        alert('Movimiento registrado exitosamente.');

        if (typeof window !== 'undefined') {
          const channel = new BroadcastChannel('stock_updates');
          channel.postMessage('refresh');
          channel.close();

          if (window.opener) {
            window.opener.postMessage({ type: 'REFRESH_STOCK' }, '*');
            window.close();
          }
        }
      } else {
        alert(`Error al registrar el movimiento: ${result.message || 'Error del servidor'}`);
      }
    } catch (error) {
      console.error(error);
      alert('No se pudo conectar con el servidor backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] font-sans p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
        <header className="bg-[#26333B] text-white p-6 flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#CBA45C] block">
              GESTIÓN DE INVENTARIO
            </span>
            <h1 className="text-xl font-serif">Registrar Movimiento de Stock</h1>
          </div>
          <span className="text-xs bg-slate-700 px-3 py-1 rounded text-slate-200">
            Usuario: Admin
          </span>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700">
          <div>
            <label className="block font-semibold text-slate-800 mb-1.5">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['INGRESO', 'EGRESO', 'TRANSFERENCIA', 'AJUSTE'] as MovementType[]).map((mType) => (
                <button
                  key={mType}
                  type="button"
                  onClick={() => setType(mType)}
                  className={`py-2 text-center rounded border font-medium transition-all ${
                    type === mType
                      ? 'bg-[#26333B] text-white border-[#26333B]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mType}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Código de Artículo
            </label>
            <input
              type="text"
              placeholder="Ej: ART-001"
              value={articleCode}
              onChange={(e) => setArticleCode(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 focus:outline-none focus:border-[#CBA45C] font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {type !== 'INGRESO' && (
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Depósito Origen
                </label>
                <select
                  value={originDeposit}
                  onChange={(e) => setOriginDeposit(e.target.value)}
                  disabled={isLoadingDeposits}
                  className="w-full border border-slate-300 rounded p-2.5 focus:outline-none focus:border-[#CBA45C] bg-white disabled:bg-slate-100"
                >
                  {isLoadingDeposits ? (
                    <option>Cargando depósitos...</option>
                  ) : (
                    deposits.map((dep) => (
                      <option key={dep.deposit_id} value={dep.deposit_id}>
                        {dep.deposit_name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {type !== 'EGRESO' && (
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Depósito Destino
                </label>
                <select
                  value={targetDeposit}
                  onChange={(e) => setTargetDeposit(e.target.value)}
                  disabled={isLoadingDeposits}
                  className="w-full border border-slate-300 rounded p-2.5 focus:outline-none focus:border-[#CBA45C] bg-white disabled:bg-slate-100"
                >
                  {isLoadingDeposits ? (
                    <option>Cargando depósitos...</option>
                  ) : (
                    deposits.map((dep) => (
                      <option key={dep.deposit_id} value={dep.deposit_id}>
                        {dep.deposit_name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Cantidad
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-slate-300 rounded p-2.5 focus:outline-none focus:border-[#CBA45C]"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Observación / Remito
            </label>
            <textarea
              rows={3}
              placeholder="Ingrese notas sobre el movimiento o número de comprobante..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 focus:outline-none focus:border-[#CBA45C]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => (window.opener ? window.close() : history.back())}
              className="px-4 py-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#26333B] text-white rounded hover:bg-slate-800 font-medium shadow transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}