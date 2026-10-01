"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, EmptyState, Field, FieldGrid, InfoBox, Input, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type CategoriaServicio = "MINIBAR" | "GASTRONOMIA" | "LAVANDERIA" | "ESTACIONAMIENTO" | "LIMPIEZA" | "TRANSPORTE" | "OTROS";
const CATEGORIAS: Array<{ value: CategoriaServicio; label: string }> = [
  { value: "MINIBAR", label: "Minibar" },
  { value: "GASTRONOMIA", label: "Desayuno y gastronomía" },
  { value: "LAVANDERIA", label: "Lavandería" },
  { value: "ESTACIONAMIENTO", label: "Estacionamiento" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "OTROS", label: "Otros servicios" },
];
const etiquetaCategoria = (categoria: CategoriaServicio) => CATEGORIAS.find((item) => item.value === categoria)?.label ?? "Otros servicios";

interface Servicio { service_id: number; category: CategoriaServicio; service_name: string; description: string | null; current_price: number | string; currency: string; active: boolean; inventory_article_id?: number | null; inventory_deposit_id?: number | null; }
interface Articulo { article_id: number; article_name: string; article_code: string; article_state: boolean; }
interface Deposito { deposit_id: number; deposit_name: string; deposit_state: boolean; }
interface MetodoPago { payment_method_id: number; payment_method: string; requires_reference: boolean; active: boolean; }
interface Estadia { room_id: number; room_number: string; reservation_id: number; reservation_code: string; guest_first_name: string; guest_last_name: string; }
interface Cargo { charge_id: number; service_name: string; quantity: number; unit_price: number | string; total_amount: number | string; charged_at: string; paid_at: string | null; payment_method: string | null; payment_reference: string | null; employees_name: string; employees_lastname: string; }
interface HistorialPrecio { price_history_id: number; previous_price: number | string | null; new_price: number | string; valid_from: string; employees_name: string; employees_lastname: string; }

const money = (value: number | string, currency = "ARS") => Number(value).toLocaleString("es-AR", { style: "currency", currency, maximumFractionDigits: 2 });

export default function ServiciosHabitacionPage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [articuloMinibar, setArticuloMinibar] = useState("");
  const [depositoMinibar, setDepositoMinibar] = useState("");
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [cargoPorCobrar, setCargoPorCobrar] = useState<Cargo | null>(null);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [estadias, setEstadias] = useState<Estadia[]>([]);
  const [roomId, setRoomId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [historialServicio, setHistorialServicio] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState<CategoriaServicio>("OTROS");
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaServicio | "TODAS">("TODAS");
  const [activo, setActivo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const estadiaActual = useMemo(() => estadias.find((e) => String(e.room_id) === roomId), [estadias, roomId]);
  const totalPendiente = useMemo(() => cargos.filter((c) => !c.paid_at).reduce((sum, c) => sum + Number(c.total_amount), 0), [cargos]);
  const serviciosFiltrados = useMemo(() => filtroCategoria === "TODAS" ? servicios : servicios.filter((s) => s.category === filtroCategoria), [servicios, filtroCategoria]);

  const cargarCatalogos = useCallback(() =>
    Promise.all([
        api.get<Servicio[]>("/servicios-habitacion/catalogo"),
        api.get<Estadia[]>("/servicios-habitacion/habitaciones-ocupadas"),
        api.get<Articulo[]>("/articulos?activos=true"),
        api.get<Deposito[]>("/depositos?activos=true"),
        api.get<MetodoPago[]>("/metodos-pago?activos=true"),
    ]).then(([lista, ocupadas, arts, deps, metodos]) => {
      setServicios(lista);
      setEstadias(ocupadas);
      setCargos([]);
      setArticulos(arts.filter((a) => a.article_state)); setDepositos(deps.filter((d) => d.deposit_state));
      setMetodosPago(metodos.filter((m) => m.active));
      setRoomId((actual) => ocupadas.some((e) => String(e.room_id) === actual) ? actual : String(ocupadas[0]?.room_id ?? ""));
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los servicios y habitaciones ocupadas.");
    }).finally(() => {
      setCargando(false);
    }), []);

  useEffect(() => { void cargarCatalogos(); }, [cargarCatalogos]);

  useEffect(() => {
    if (!estadiaActual) return;
    let vigente = true;
    api.get<Cargo[]>(`/servicios-habitacion/habitaciones/${estadiaActual.room_id}/cargos`)
      .then((lista) => { if (vigente) setCargos(lista); })
      .catch((err) => { if (vigente) setError(err instanceof ApiError ? err.message : "No se pudieron cargar los cargos de la habitación."); });
    return () => { vigente = false; };
  }, [estadiaActual]);

  const limpiarFormulario = () => { setEditando(null); setNombre(""); setDescripcion(""); setPrecio(""); setCategoria("OTROS"); setActivo(true); setArticuloMinibar(""); setDepositoMinibar(""); };
  const editar = (servicio: Servicio) => {
    setEditando(servicio.service_id); setNombre(servicio.service_name); setDescripcion(servicio.description ?? ""); setCategoria(servicio.category);
    setPrecio(String(servicio.current_price)); setActivo(servicio.active);
    setArticuloMinibar(String(servicio.inventory_article_id ?? ""));
    setDepositoMinibar(String(servicio.inventory_deposit_id ?? ""));
  };

  const guardarServicio = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setAviso(null); setGuardando(true);
    try {
      const body = { category: categoria, service_name: nombre.trim(), description: descripcion.trim() || null, current_price: Number(precio), currency: "ARS", active: activo, inventory_article_id: categoria === "MINIBAR" ? Number(articuloMinibar) : null, inventory_deposit_id: categoria === "MINIBAR" ? Number(depositoMinibar) : null, employeeId: Number(window.localStorage.getItem("employeeId") ?? 1) };
      if (editando) await api.patch(`/servicios-habitacion/catalogo/${editando}`, body);
      else await api.post("/servicios-habitacion/catalogo", body);
      setAviso(editando ? "Servicio y precio actualizados. El historial conserva los valores anteriores." : "Servicio creado con precio inicial registrado.");
      limpiarFormulario(); await cargarCatalogos();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el servicio.");
    } finally { setGuardando(false); }
  };

  const verHistorial = async (servicio: Servicio) => {
    setError(null);
    try {
      setHistorial(await api.get<HistorialPrecio[]>(`/servicios-habitacion/catalogo/${servicio.service_id}/precios`));
      setHistorialServicio(servicio.service_id);
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial de precios."); }
  };

  const cargarConsumo = async (event: FormEvent) => {
    event.preventDefault(); if (!estadiaActual) return;
    setError(null); setAviso(null); setGuardando(true);
    try {
      await api.post(`/servicios-habitacion/habitaciones/${estadiaActual.room_id}/cargos`, {
        expectedReservationId: estadiaActual.reservation_id, serviceId: Number(serviceId), quantity: Number(cantidad),
        employeeId: Number(window.localStorage.getItem("employeeId") ?? 1),
      });
      setAviso(`Consumo agregado a la habitación ${estadiaActual.room_number}.`); setCantidad("1");
      setCargos(await api.get<Cargo[]>(`/servicios-habitacion/habitaciones/${estadiaActual.room_id}/cargos`));
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo cargar el consumo."); }
    finally { setGuardando(false); }
  };

  const cobrar = async (event: FormEvent) => {
    event.preventDefault();
    const cargo = cargoPorCobrar;
    if (!estadiaActual) return;
    setError(null);
    try {
      const metodo = metodosPago.find((m) => String(m.payment_method_id) === metodoPagoId);
      if (!cargo || !metodo) { setError("Elegí un medio de pago."); return; }
      if (metodo.requires_reference && !referenciaPago.trim()) { setError("Este medio de pago requiere número de referencia."); return; }
      await api.patch(`/servicios-habitacion/cargos/${cargo.charge_id}/cobrar`, { paymentMethodId: Number(metodoPagoId), paymentReference: referenciaPago.trim() || undefined, employeeId: Number(window.localStorage.getItem("employeeId") ?? 1) });
      setCargos(await api.get<Cargo[]>(`/servicios-habitacion/habitaciones/${estadiaActual.room_id}/cargos`));
      setAviso("Cargo cobrado y medio de pago registrado."); setCargoPorCobrar(null); setReferenciaPago("");
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo actualizar el cobro."); }
  };

  return <>
    <PageHeader eyebrow="" titulo="Servicios y consumos" descripcion="" />
    {error && <div className="mb-4"><InfoBox tipo="error">{error}</InfoBox></div>}
    {aviso && <div className="mb-4"><InfoBox tipo="exito">{aviso}</InfoBox></div>}

    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <Card>
        <h2 className="mb-4 font-serif text-lg">{editando ? "Editar servicio y precio" : "Nuevo servicio"}</h2>
        <form onSubmit={guardarServicio} className="space-y-4">
          <Field label="Nombre del servicio" htmlFor="servicio-nombre" requerido><Input id="servicio-nombre" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} required disabled={guardando} /></Field>
          <Field label="Descripción" htmlFor="servicio-descripcion"><Input id="servicio-descripcion" value={descripcion} maxLength={255} onChange={(e) => setDescripcion(e.target.value)} disabled={guardando} /></Field>
          <Field label="Categoría" htmlFor="servicio-categoria" requerido><Select id="servicio-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaServicio)} disabled={guardando}>{CATEGORIAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          {categoria === "MINIBAR" && <FieldGrid>
            <Field label="Artículo de inventario" htmlFor="minibar-articulo" requerido><Select id="minibar-articulo" value={articuloMinibar} onChange={(e) => setArticuloMinibar(e.target.value)} required disabled={guardando}><option value="">Elegí el producto</option>{articulos.map((a) => <option key={a.article_id} value={a.article_id}>{a.article_name} · {a.article_code}</option>)}</Select></Field>
            <Field label="Depósito del minibar" htmlFor="minibar-deposito" requerido><Select id="minibar-deposito" value={depositoMinibar} onChange={(e) => setDepositoMinibar(e.target.value)} required disabled={guardando}><option value="">Elegí el depósito</option>{depositos.map((d) => <option key={d.deposit_id} value={d.deposit_id}>{d.deposit_name}</option>)}</Select></Field>
            <p className="text-xs text-carbon/55">Cada consumo de este servicio descontará la cantidad indicada del stock seleccionado y registrará un movimiento de consumo.</p>
          </FieldGrid>}
          <FieldGrid>
            <Field label="Precio (ARS)" htmlFor="servicio-precio" requerido><Input id="servicio-precio" type="number" min="0.01" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required disabled={guardando} /></Field>
            <Field label="Estado" htmlFor="servicio-activo"><Select id="servicio-activo" value={activo ? "true" : "false"} onChange={(e) => setActivo(e.target.value === "true")} disabled={guardando}><option value="true">Activo</option><option value="false">Inactivo</option></Select></Field>
          </FieldGrid>
          <div className="flex justify-end gap-2"><Button type="submit" cargando={guardando}>{editando ? "Guardar cambios" : "Crear servicio"}</Button>{editando && <Button type="button" variante="secundario" onClick={limpiarFormulario}>Cancelar</Button>}</div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-lg">Catálogo y precios vigentes</h2><div className="w-full sm:w-64"><Select aria-label="Filtrar servicios por categoría" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value as CategoriaServicio | "TODAS")}><option value="TODAS">Todas las categorías</option>{CATEGORIAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div></div>
        {cargando ? <p className="py-8 text-center text-sm text-carbon/50">Cargando catálogo…</p> : servicios.length === 0 ? <EmptyState titulo="Todavía no hay servicios" descripcion="Creá un servicio para poder cargarlo al folio de una habitación." /> : serviciosFiltrados.length === 0 ? <EmptyState titulo="No hay servicios en esta categoría" descripcion="Elegí otra categoría o asigná servicios desde el formulario." /> : (
          <Table><THead><TH>Servicio</TH><TH>Precio</TH><TH>Estado</TH><TH className="whitespace-nowrap text-right">Acciones</TH></THead><TBody>
            {serviciosFiltrados.map((s) => <TR key={s.service_id}><TD><div className="mb-1"><Badge tono="info">{etiquetaCategoria(s.category)}</Badge></div><span className="block font-medium">{s.service_name}</span><span className="text-xs text-carbon/50">{s.description}</span></TD><TD>{money(s.current_price, s.currency)}</TD><TD><Badge tono={s.active ? "activo" : "inactivo"}>{s.active ? "Activo" : "Inactivo"}</Badge></TD><TD className="min-w-42"><div className="flex flex-nowrap justify-end gap-2"><Button tamano="sm" variante="secundario" onClick={() => editar(s)}>Editar</Button><Button tamano="sm" variante="secundario" onClick={() => void verHistorial(s)}>Precios</Button></div></TD></TR>)}
          </TBody></Table>
        )}
        {historialServicio && <div className="mt-4 rounded-lg border border-line p-3"><h3 className="mb-2 text-sm font-semibold">Historial de precios</h3>{historial.map((h) => <div key={h.price_history_id} className="flex flex-wrap justify-between gap-2 border-t border-line py-2 text-xs"><span>{new Date(h.valid_from).toLocaleString("es-AR")} · {h.employees_name} {h.employees_lastname}</span><span>{h.previous_price == null ? "Inicial" : money(h.previous_price)} → <strong>{money(h.new_price)}</strong></span></div>)}</div>}
      </Card>
    </div>

    <Card className="mt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-lg">Cargos por habitación</h2><p className="text-sm text-carbon/55">Los consumos se cargan al cuarto y quedan en el folio de la estadía activa para el check-out.</p></div>{estadiaActual && <Badge tono="info">Pendiente de cobro: {money(totalPendiente)}</Badge>}</div>
      {estadias.length === 0 ? <EmptyState titulo="No hay habitaciones ocupadas" descripcion="Los consumos se habilitan durante una estadía con check-in realizado." /> : <>
        <form onSubmit={cargarConsumo} className="mb-5 grid gap-4 md:grid-cols-4 md:items-end">
          <Field label="Habitación ocupada" htmlFor="cargo-habitacion" requerido><Select id="cargo-habitacion" value={roomId} disabled={guardando || cargoPorCobrar !== null} onChange={(e) => { setRoomId(e.target.value); setCargos([]); }}><option value="">Elegí habitación</option>{estadias.map((e) => <option key={e.reservation_id} value={e.room_id}>Hab. {e.room_number} · {e.guest_last_name}, {e.guest_first_name}</option>)}</Select></Field>
          <Field label="Servicio" htmlFor="cargo-servicio" requerido><Select id="cargo-servicio" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required><option value="">Elegí servicio</option>{servicios.filter((s) => s.active).map((s) => <option key={s.service_id} value={s.service_id}>{etiquetaCategoria(s.category)} · {s.service_name} · {money(s.current_price, s.currency)}</option>)}</Select></Field>
          <Field label="Cantidad" htmlFor="cargo-cantidad" requerido><Input id="cargo-cantidad" type="number" min="1" max="100" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required /></Field>
          <Button type="submit" cargando={guardando} disabled={!estadiaActual || !serviceId}>Cargar a habitación</Button>
        </form>
        {cargos.length === 0 ? <EmptyState titulo="Sin consumos registrados" descripcion="Los cargos que agregues aparecerán acá y se sumarán al cierre de esta estadía." /> : <Table><THead><TH>Servicio</TH><TH>Cantidad</TH><TH>Precio unitario</TH><TH>Total</TH><TH>Fecha</TH><TH>Estado</TH><TH /></THead><TBody>{cargos.map((c) => <TR key={c.charge_id}><TD>{c.service_name}</TD><TD>{c.quantity}</TD><TD>{money(c.unit_price)}</TD><TD className="font-semibold">{money(c.total_amount)}</TD><TD>{new Date(c.charged_at).toLocaleString("es-AR")}</TD><TD><Badge tono={c.paid_at ? "activo" : "alerta"}>{c.paid_at ? `Cobrado${c.payment_method ? ` · ${c.payment_method}` : ""}` : "Pendiente"}</Badge>{c.payment_reference && <span className="ml-1 block text-xs text-carbon/55">Ref. {c.payment_reference}</span>}</TD><TD>{!c.paid_at && <Button tamano="sm" variante="secundario" onClick={() => { setCargoPorCobrar(c); setMetodoPagoId(String(metodosPago[0]?.payment_method_id ?? "")); setReferenciaPago(""); }}>Registrar cobro</Button>}</TD></TR>)}</TBody></Table>}
      </>}
    </Card>
    {cargoPorCobrar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCargoPorCobrar(null); }}><Card className="w-full max-w-md"><h2 className="mb-1 font-serif text-lg">Registrar cobro</h2><p className="mb-4 text-sm text-carbon/60">{cargoPorCobrar.service_name} · {money(cargoPorCobrar.total_amount)}</p><form onSubmit={cobrar} className="space-y-4"><Field label="Medio de pago" htmlFor="cargo-metodo-pago" requerido><Select id="cargo-metodo-pago" value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} required><option value="">Elegí medio de pago</option>{metodosPago.map((m) => <option key={m.payment_method_id} value={m.payment_method_id}>{m.payment_method}</option>)}</Select></Field>{metodosPago.find((m) => String(m.payment_method_id) === metodoPagoId)?.requires_reference && <Field label="Referencia" htmlFor="cargo-referencia" requerido><Input id="cargo-referencia" value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)} maxLength={100} required /></Field>}<div className="flex justify-end gap-2"><Button type="button" variante="secundario" onClick={() => setCargoPorCobrar(null)}>Cancelar</Button><Button type="submit">Confirmar cobro</Button></div></form></Card></div>}
  </>;
}
