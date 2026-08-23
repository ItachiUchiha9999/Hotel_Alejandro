'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';

const API_BASE = 'http://localhost:3000/api/articulos';

// ---------- Tipos ----------

interface Articulo {
  article_id: number;
  category_id: number;
  category_name?: string; // solo viene si el backend hace JOIN con categories (ver nota al pie)
  article_code: string;
  article_number: string;
  article_name: string;
  article_compound_name: string;
  article_description: string | null;
  article_unit_of_measure: string;
  article_stock_min_general: string | number;
  article_state: boolean;
}

interface Categoria {
  id: number;
  nombre: string;
}

interface FichaForm {
  categoriaId: string;
  unidadMedida: string;
  stockMinimo: string;
  descripcion: string;
}

interface NuevoArticuloForm {
  codigo: string;
  numero: string;
  nombre: string;
  nombreCompuesto: string;
  categoriaId: string;
  unidadMedida: string;
  stockMinimo: string;
  descripcion: string;
}

const NUEVO_FORM_VACIO: NuevoArticuloForm = {
  codigo: '',
  numero: '',
  nombre: '',
  nombreCompuesto: '',
  categoriaId: '',
  unidadMedida: 'UNIDAD',
  stockMinimo: '0',
  descripcion: '',
};

// ---------- Componente ----------

export default function CatalogoArticulosPage() {
  // Guard de hidratación: hasta que el cliente termine de montar, renderizamos un
  // placeholder idéntico en servidor y cliente. Evita que extensiones del navegador
  // o un primer render con estructura distinta disparen
  // "NotFoundError: Failed to execute 'removeChild' on 'Node'" durante la reconciliación.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    setMontado(true);
  }, []);

  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Sin selección por defecto: la ficha solo aparece cuando el usuario elige una fila
  const [seleccionado, setSeleccionado] = useState<Articulo | null>(null);
  const [fichaForm, setFichaForm] = useState<FichaForm | null>(null);
  const [guardandoFicha, setGuardandoFicha] = useState(false);
  const [errorFicha, setErrorFicha] = useState<string | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  // Modal alta
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formNuevo, setFormNuevo] = useState<NuevoArticuloForm>(NUEVO_FORM_VACIO);
  const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({});
  const [enviandoNuevo, setEnviandoNuevo] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  useEffect(() => {
    if (montado) cargarArticulos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado]);

  async function cargarArticulos(mantenerSeleccion = false) {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await fetch(API_BASE, { cache: 'no-store' });
      if (!res.ok) throw new Error(`El servidor respondió con estado ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('La respuesta del servidor no tiene el formato esperado');

      setArticulos(data);

      // Solo reabrimos la ficha si ya había una selección activa (ej: tras guardar
      // cambios o cambiar el estado). En la carga inicial no se selecciona nada.
      if (mantenerSeleccion && seleccionado) {
        const actualizado = data.find((a: Articulo) => a.article_id === seleccionado.article_id);
        if (actualizado) {
          seleccionarArticulo(actualizado);
        } else {
          cerrarFicha();
        }
      }
    } catch (err) {
      setErrorCarga(
        err instanceof Error ? `No se pudo conectar con el servidor: ${err.message}` : 'No se pudo conectar con el servidor'
      );
    } finally {
      setCargando(false);
    }
  }

  function seleccionarArticulo(articulo: Articulo) {
    setSeleccionado(articulo);
    setErrorFicha(null);
    setFichaForm({
      categoriaId: String(articulo.category_id ?? ''),
      unidadMedida: articulo.article_unit_of_measure ?? 'UNIDAD',
      stockMinimo: String(articulo.article_stock_min_general ?? 0),
      descripcion: articulo.article_description ?? '',
    });
  }

  function cerrarFicha() {
    setSeleccionado(null);
    setFichaForm(null);
    setErrorFicha(null);
  }

  // Categorías conocidas: derivadas de los artículos ya cargados (no hay GET /api/categorias todavía)
  const categorias: Categoria[] = useMemo(() => {
    const mapa = new Map<number, string>();
    articulos.forEach((a) => {
      if (a.category_id != null && !mapa.has(a.category_id)) {
        mapa.set(a.category_id, a.category_name || `Categoría ${a.category_id}`);
      }
    });
    return Array.from(mapa.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [articulos]);

  const articulosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return articulos.filter((a) => {
      const matchTexto =
        !texto ||
        a.article_code.toLowerCase().includes(texto) ||
        a.article_name.toLowerCase().includes(texto) ||
        a.article_compound_name?.toLowerCase().includes(texto);

      const matchCategoria = filtroCategoria === 'todas' || String(a.category_id) === filtroCategoria;

      const matchEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && a.article_state) ||
        (filtroEstado === 'inactivos' && !a.article_state);

      return matchTexto && matchCategoria && matchEstado;
    });
  }, [articulos, busqueda, filtroCategoria, filtroEstado]);

  // ---------- Guardar cambios de la ficha (PUT) ----------
  async function handleGuardarFicha() {
    if (!seleccionado || !fichaForm) return;
    setErrorFicha(null);

    if (!fichaForm.categoriaId.trim() || Number.isNaN(Number(fichaForm.categoriaId))) {
      setErrorFicha('Ingresá un ID de categoría numérico válido');
      return;
    }
    if (fichaForm.stockMinimo.trim() && Number.isNaN(Number(fichaForm.stockMinimo))) {
      setErrorFicha('El stock mínimo debe ser un número');
      return;
    }

    setGuardandoFicha(true);
    try {
      const res = await fetch(`${API_BASE}/${seleccionado.article_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoriaId: Number(fichaForm.categoriaId),
          unidadMedida: fichaForm.unidadMedida.trim() || 'UNIDAD',
          stockMinimo: fichaForm.stockMinimo.trim() ? Number(fichaForm.stockMinimo) : 0,
          descripcion: fichaForm.descripcion.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const mensaje = data && typeof data.error === 'string' ? data.error : `El servidor respondió con estado ${res.status}`;
        throw new Error(mensaje);
      }
      await cargarArticulos(true);
    } catch (err) {
      setErrorFicha(err instanceof Error ? err.message : 'No se pudieron guardar los cambios');
    } finally {
      setGuardandoFicha(false);
    }
  }

  // ---------- Baja lógica / reactivación (PATCH /estado) ----------
  async function handleToggleEstado() {
    if (!seleccionado) return;
    setErrorFicha(null);
    setCambiandoEstado(true);
    try {
      const res = await fetch(`${API_BASE}/${seleccionado.article_id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: !seleccionado.article_state }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const mensaje = data && typeof data.error === 'string' ? data.error : `El servidor respondió con estado ${res.status}`;
        throw new Error(mensaje);
      }
      await cargarArticulos(true);
    } catch (err) {
      setErrorFicha(err instanceof Error ? err.message : 'No se pudo cambiar el estado del artículo');
    } finally {
      setCambiandoEstado(false);
    }
  }

  // ---------- Alta de artículo (POST) ----------
  function actualizarCampoNuevo<K extends keyof NuevoArticuloForm>(campo: K, valor: string) {
    setFormNuevo((prev) => ({ ...prev, [campo]: valor }));
    setErroresNuevo((prev) => {
      if (!prev[campo]) return prev;
      const copia = { ...prev };
      delete copia[campo];
      return copia;
    });
  }

  function validarNuevo(): boolean {
    const errores: Record<string, string> = {};
    if (!formNuevo.codigo.trim()) errores.codigo = 'Obligatorio';
    if (!formNuevo.numero.trim()) errores.numero = 'Obligatorio';
    if (!formNuevo.nombre.trim()) errores.nombre = 'Obligatorio';
    if (!formNuevo.nombreCompuesto.trim()) errores.nombreCompuesto = 'Obligatorio';
    if (!formNuevo.categoriaId.trim() || Number.isNaN(Number(formNuevo.categoriaId))) {
      errores.categoriaId = 'ID numérico requerido';
    }
    if (formNuevo.stockMinimo.trim() && Number.isNaN(Number(formNuevo.stockMinimo))) {
      errores.stockMinimo = 'Debe ser un número';
    }
    setErroresNuevo(errores);
    return Object.keys(errores).length === 0;
  }

  async function handleCrearNuevo(e: FormEvent) {
    e.preventDefault();
    setErrorNuevo(null);
    if (!validarNuevo()) return;

    setEnviandoNuevo(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: formNuevo.codigo.trim(),
          numero: formNuevo.numero.trim(),
          nombre: formNuevo.nombre.trim(),
          nombreCompuesto: formNuevo.nombreCompuesto.trim(),
          categoriaId: Number(formNuevo.categoriaId),
          unidadMedida: formNuevo.unidadMedida.trim() || 'UNIDAD',
          stockMinimo: formNuevo.stockMinimo.trim() ? Number(formNuevo.stockMinimo) : 0,
          descripcion: formNuevo.descripcion.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const mensaje = data && typeof data.error === 'string' ? data.error : `El servidor respondió con estado ${res.status}`;
        throw new Error(mensaje);
      }
      setModalAbierto(false);
      setFormNuevo(NUEVO_FORM_VACIO);
      await cargarArticulos();
    } catch (err) {
      setErrorNuevo(err instanceof Error ? err.message : 'No se pudo crear el artículo');
    } finally {
      setEnviandoNuevo(false);
    }
  }

  function cerrarModal() {
    setModalAbierto(false);
    setFormNuevo(NUEVO_FORM_VACIO);
    setErroresNuevo({});
    setErrorNuevo(null);
  }

  // Placeholder de pre-montaje: misma estructura mínima en servidor y cliente
  if (!montado) {
    return <div className="flex h-screen w-full bg-[#fcfbfa]" />;
  }

  const hayFicha = Boolean(seleccionado && fichaForm);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fcfbfa] font-sans text-[#1c2833]">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-[#1e292f] text-[#f4efe4]">
        <div>
          <div className="border-b border-white/5 p-6">
            <span className="block font-serif text-[10px] uppercase tracking-[0.25em] text-[#cba45c]">Hotel</span>
            <h1 className="font-serif text-xl tracking-wider text-white">ALEJANDRO I</h1>
            <span className="text-[8px] uppercase tracking-[0.2em] text-slate-400">[ Salta · Argentina ]</span>
          </div>

          <div className="px-3 py-4">
            <div className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Módulo STK
            </div>
            <nav className="space-y-0.5 text-xs">
              <NavItem label="Depósitos" />
              <NavItem label="Artículos" activo />
              <NavItem label="Stock por depósito" />
              <NavItem label="Tipos de movimiento" />
              <NavItem label="Movimientos" />
              <NavItem label="Transferencias" />
              <NavItem label="Reportes" />
            </nav>
          </div>
        </div>

        <div className="border-t border-white/5 p-4 text-[11px] text-slate-400">L. Farfán · Encargado</div>
      </aside>

      {/* Principal */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="flex items-start justify-between border-b border-slate-100 px-8 pb-4 pt-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              STK-02 · Administración
            </div>
            <h2 className="mt-0.5 font-serif text-3xl text-[#1e292f]">Artículos</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Todavía no implementado"
              className="cursor-not-allowed border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-400"
            >
              Importar CSV
            </button>
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="bg-[#1e292f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2b3a42]"
            >
              Nuevo artículo
            </button>
          </div>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-[#faf9f6] px-8 py-3 text-xs">
          <div className="flex max-w-2xl flex-1 items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por código o nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-64 border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:border-[#cba45c] focus:outline-none"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:border-[#cba45c] focus:outline-none"
            >
              <option value="todas">Categoría: todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:border-[#cba45c] focus:outline-none"
            >
              <option value="todos">Estado: todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
          <div className="text-[11px] text-slate-400">
            {articulos.length} artículo{articulos.length !== 1 ? 's' : ''} · {articulosFiltrados.length} visible
            {articulosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Error de conexión */}
        {!cargando && errorCarga && (
          <div className="mx-8 mt-4 border px-4 py-3 text-xs" style={{ borderColor: '#B4694A', color: '#8a3f28' }}>
            {errorCarga}{' '}
            <button type="button" onClick={() => cargarArticulos()} className="ml-2 underline">
              Reintentar
            </button>
          </div>
        )}

        {/* Tabla + Ficha: 1 columna (ancho completo) sin selección, 2 columnas con ficha abierta */}
        <div
          className={`grid flex-1 overflow-hidden ${
            hayFicha ? 'grid-cols-1 xl:grid-cols-[1.5fr_1fr]' : 'grid-cols-1'
          }`}
        >
          {/* Tabla */}
          <div className="flex flex-col justify-between overflow-y-auto border-r border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2.5 font-normal">Código</th>
                    <th className="px-4 py-2.5 font-normal">Artículo</th>
                    <th className="px-4 py-2.5 font-normal">Categoría</th>
                    <th className="px-4 py-2.5 font-normal">U.M.</th>
                    <th className="px-4 py-2.5 text-right font-normal">Mín.</th>
                    <th className="px-4 py-2.5 text-center font-normal">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cargando ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        Cargando catálogo…
                      </td>
                    </tr>
                  ) : articulosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No se encontraron artículos con estos filtros.
                      </td>
                    </tr>
                  ) : (
                    articulosFiltrados.map((art) => {
                      const activo = seleccionado?.article_id === art.article_id;
                      return (
                        <tr
                          key={art.article_id}
                          onClick={() => seleccionarArticulo(art)}
                          className={`cursor-pointer transition-colors ${
                            activo ? 'bg-[#faf6ee] font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-2 font-mono text-slate-800">{art.article_code}</td>
                          <td className="px-4 py-2 text-slate-900">{art.article_name}</td>
                          <td className="px-4 py-2 text-slate-500">
                            {art.category_name || `Categoría ${art.category_id}`}
                          </td>
                          <td className="px-4 py-2 text-slate-500">{art.article_unit_of_measure}</td>
                          <td className="px-4 py-2 text-right font-mono">
                            {formatearNumero(art.article_stock_min_general)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <EstadoBadge activo={art.article_state} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-white p-3 text-[11px] text-slate-400">
              La categoría se referencia por ID hasta que exista un endpoint de catálogo de categorías.
            </div>
          </div>

          {/* Ficha: solo se monta cuando hay un artículo seleccionado */}
          {hayFicha && seleccionado && fichaForm && (
            <div className="flex flex-col justify-between overflow-y-auto bg-white p-6">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#b8914b]">
                      Ficha · {seleccionado.article_code}
                    </div>
                    <h3 className="mt-1 font-serif text-2xl text-[#1e292f]">{seleccionado.article_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{seleccionado.article_compound_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={cerrarFicha}
                    aria-label="Cerrar ficha"
                    title="Cerrar ficha"
                    className="shrink-0 border border-slate-200 px-2 py-1 text-sm leading-none text-slate-400 hover:border-[#cba45c] hover:text-[#1e292f]"
                  >
                    ✕
                  </button>
                </div>

                {errorFicha && (
                  <div className="border px-3 py-2 text-xs" style={{ borderColor: '#B4694A', color: '#8a3f28' }}>
                    {errorFicha}
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        ID Categoría
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        list="categorias-conocidas"
                        value={fichaForm.categoriaId}
                        onChange={(e) => setFichaForm({ ...fichaForm, categoriaId: e.target.value })}
                        className="w-full border border-slate-200 bg-white p-2 text-slate-800 focus:border-[#cba45c] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Unidad de medida
                      </label>
                      <input
                        type="text"
                        value={fichaForm.unidadMedida}
                        onChange={(e) => setFichaForm({ ...fichaForm, unidadMedida: e.target.value })}
                        className="w-full border border-slate-200 bg-white p-2 text-slate-800 focus:border-[#cba45c] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Stock mínimo
                      </label>
                      <input
                        type="number"
                        value={fichaForm.stockMinimo}
                        onChange={(e) => setFichaForm({ ...fichaForm, stockMinimo: e.target.value })}
                        className="w-full border border-slate-200 bg-white p-2 text-slate-800 focus:border-[#cba45c] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Estado
                      </label>
                      <div className="flex h-[38px] items-center">
                        <EstadoBadge activo={seleccionado.article_state} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Descripción
                    </label>
                    <textarea
                      rows={3}
                      value={fichaForm.descripcion}
                      onChange={(e) => setFichaForm({ ...fichaForm, descripcion: e.target.value })}
                      className="w-full border border-slate-200 bg-white p-2 text-slate-800 focus:border-[#cba45c] focus:outline-none"
                    />
                  </div>

                  <div className="pt-2">
                    <div className="mb-2 border-b border-slate-100 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Existencia por depósito
                    </div>
                    <p className="text-[11px] italic text-slate-400">
                      Disponible cuando se integre con la consulta de stock consolidado (HU-07).
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
                  <button
                    type="button"
                    onClick={handleToggleEstado}
                    disabled={cambiandoEstado}
                    className="border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {cambiandoEstado
                      ? 'Guardando…'
                      : seleccionado.article_state
                      ? 'Dar de baja'
                      : 'Reactivar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarFicha}
                    disabled={guardandoFicha}
                    className="bg-[#1e292f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2b3a42] disabled:opacity-50"
                  >
                    {guardandoFicha ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* datalist compartido para sugerencias de categoría */}
      <datalist id="categorias-conocidas">
        {categorias.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.nombre}
          </option>
        ))}
      </datalist>

      {/* Modal Nuevo Artículo */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={cerrarModal}
        >
          <div
            className="w-full max-w-md border border-slate-300 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 font-serif text-lg text-[#1e292f]">Registrar nuevo artículo</h3>

            <form onSubmit={handleCrearNuevo} className="max-h-[70vh] space-y-3 overflow-y-auto text-xs">
              {errorNuevo && (
                <div className="border px-3 py-2" style={{ borderColor: '#B4694A', color: '#8a3f28' }}>
                  {errorNuevo}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <CampoModal
                  label="Código *"
                  placeholder="ART-3006"
                  valor={formNuevo.codigo}
                  onChange={(v) => actualizarCampoNuevo('codigo', v)}
                  error={erroresNuevo.codigo}
                />
                <CampoModal
                  label="Número *"
                  placeholder="3006"
                  valor={formNuevo.numero}
                  onChange={(v) => actualizarCampoNuevo('numero', v)}
                  error={erroresNuevo.numero}
                />
              </div>

              <CampoModal
                label="Nombre *"
                placeholder="Toallas de Mano"
                valor={formNuevo.nombre}
                onChange={(v) => actualizarCampoNuevo('nombre', v)}
                error={erroresNuevo.nombre}
              />

              <CampoModal
                label="Nombre compuesto *"
                placeholder="Toalla de Mano 30x50 Blanca"
                valor={formNuevo.nombreCompuesto}
                onChange={(v) => actualizarCampoNuevo('nombreCompuesto', v)}
                error={erroresNuevo.nombreCompuesto}
              />

              <div className="grid grid-cols-3 gap-2">
                <CampoModal
                  label="ID Categoría *"
                  placeholder="1"
                  valor={formNuevo.categoriaId}
                  onChange={(v) => actualizarCampoNuevo('categoriaId', v)}
                  error={erroresNuevo.categoriaId}
                  listId="categorias-conocidas"
                  inputMode="numeric"
                />
                <CampoModal
                  label="U.M."
                  placeholder="UNIDAD"
                  valor={formNuevo.unidadMedida}
                  onChange={(v) => actualizarCampoNuevo('unidadMedida', v)}
                  error={erroresNuevo.unidadMedida}
                />
                <CampoModal
                  label="Stock mínimo"
                  placeholder="0"
                  valor={formNuevo.stockMinimo}
                  onChange={(v) => actualizarCampoNuevo('stockMinimo', v)}
                  error={erroresNuevo.stockMinimo}
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase text-slate-500">Descripción</label>
                <textarea
                  rows={2}
                  value={formNuevo.descripcion}
                  onChange={(e) => actualizarCampoNuevo('descripcion', e.target.value)}
                  className="w-full border border-slate-300 p-2"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-3 py-1.5 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoNuevo}
                  className="bg-[#1e292f] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                >
                  {enviandoNuevo ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

function NavItem({ label, activo = false }: { label: string; activo?: boolean }) {
  return (
    <a
      href="#"
      className={
        activo
          ? 'flex items-center rounded bg-[#cba45c] px-3 py-2 font-semibold text-[#1e292f] shadow-sm'
          : 'flex items-center rounded px-3 py-2 text-slate-300 hover:text-white'
      }
    >
      {label}
    </a>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        activo ? 'border-[#cba45c] text-[#8a6d2f]' : 'border-slate-300 text-slate-400'
      }`}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

interface CampoModalProps {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  error?: string;
  placeholder?: string;
  listId?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
}

function CampoModal({ label, valor, onChange, error, placeholder, listId, inputMode = 'text' }: CampoModalProps) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase text-slate-500">{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        list={listId}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border p-2 ${error ? 'border-[#B4694A]' : 'border-slate-300'}`}
      />
      {error && <p className="mt-0.5 text-[10px]" style={{ color: '#B4694A' }}>{error}</p>}
    </div>
  );
}

// ---------- Utilidades ----------

function formatearNumero(valor: string | number): string {
  const num = typeof valor === 'string' ? Number(valor) : valor;
  if (Number.isNaN(num)) return String(valor);
  return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}