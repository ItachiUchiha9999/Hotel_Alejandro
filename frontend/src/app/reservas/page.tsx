"use client";

/**
 * Grilla principal de reservas (RES-01, RES-09, RES-11).
 *
 * Es la pantalla de recepción: ver qué reservas hay, filtrar por estado, y
 * accionar el check-in / check-out del día. La creación de reservas sigue
 * viviendo en /reservas/nueva; esta pantalla no la reemplaza.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldGrid,
  Input,
  InfoBox,
  Select,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { api, checkInReserva, checkOutReserva, getReservas, ApiError } from "@/lib/api";
import type { EstadoReserva, Reserva } from "@/lib/types";

/* ---------------------------------------------------------------------------
 * Utilidades de fecha y presentación
 * ------------------------------------------------------------------------- */

/** Las fechas del backend son DATE en UTC-medianoche: hay que leerlas en UTC
 *  para que no se corran un día según la zona horaria del navegador. */
const formatearFecha = (valor: string) =>
  new Date(valor).toLocaleDateString("es-AR", { timeZone: "UTC" });

/** "Hoy" a medianoche UTC, para comparar contra check_in_date sin horas. */
const hoyUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const yaLlegoLaFecha = (checkInDate: string) => new Date(checkInDate) <= hoyUTC();
const formatoMoneda = (valor: number | string) => Number(valor).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const detallePago = (referencia: string | null) => {
  const tarjetaWeb = referencia?.startsWith("SIMULADO WEB: TARJETA");
  const ultimos = referencia?.match(/^SIMULADO WEB: TARJETA \*{4}(\d{4})/);
  if (tarjetaWeb) return ultimos ? ` · Tarjeta terminada en ${ultimos[1]}` : " · Terminación no disponible";
  return referencia && !referencia.startsWith("SIMULADO WEB:") ? ` · Ref. ${referencia}` : "";
};

interface CargoPendiente {
  charge_id: number;
  service_name: string;
  quantity: number;
  unit_price: number | string;
  total_amount: number | string;
  charged_at: string;
  paid_at: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
}
interface MetodoPago { payment_method_id: number; payment_method: string; requires_reference: boolean; active: boolean; }
interface PagoAlojamiento { reservation_payment_id: number; amount: number | string; paid_at: string; payment_reference: string | null; payment_method: string; employees_name: string; employees_lastname: string; }
interface EstadoCuenta {
  reservation_id: number;
  total_alojamiento: number;
  abonado_alojamiento: number;
  saldo_alojamiento: number;
  pagos_alojamiento: PagoAlojamiento[];
  total_consumos: number;
  consumos_abonados: number;
  consumos_pendientes: number;
  cargos: CargoPendiente[];
  total_cuenta: number;
  total_abonado: number;
  saldo_total: number;
}

const tonoPorEstado: Record<EstadoReserva, "activo" | "inactivo" | "info" | "alerta"> = {
  PENDIENTE: "alerta",
  CONFIRMADA: "info",
  IN_HOUSE: "activo",
  FINALIZADA: "inactivo",
  CANCELADA: "inactivo",
  NO_SHOW: "alerta",
};

const etiquetaEstado: Record<EstadoReserva, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  IN_HOUSE: "In-House",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
};

const etiquetaOrigen: Record<string, string> = {
  WEB: "Sitio web",
  RECEPCION: "Recepción",
  TELEFONO: "Teléfono",
  AGENCIA: "Agencia",
  CORPORATIVO: "Corporativo",
};
const origenReserva = (origen: string) => etiquetaOrigen[origen] ?? (origen || "Sin informar");

/** El usuario de recepción todavía no viene de un login real (ver .env
 *  DEFAULT_EMPLOYEE_ID). Se lee el mismo valor que ya guarda ReservaForm.tsx
 *  al crear una reserva, para no pedirlo dos veces. */
const leerEmployeeId = () => {
  if (typeof window === "undefined") return "1";
  return window.localStorage.getItem("employeeId") ?? "1";
};

/* ---------------------------------------------------------------------------
 * Pestañas de filtro rápido
 * ------------------------------------------------------------------------- */

type FiltroPestana = "TODAS" | "PENDIENTE" | "CONFIRMADA" | "IN_HOUSE" | "FINALIZADA";

const PESTANAS: Array<{ valor: FiltroPestana; etiqueta: string }> = [
  { valor: "TODAS", etiqueta: "Todas" },
  { valor: "PENDIENTE", etiqueta: "Pendientes" },
  { valor: "CONFIRMADA", etiqueta: "Confirmadas" },
  { valor: "IN_HOUSE", etiqueta: "In-House" },
  { valor: "FINALIZADA", etiqueta: "Finalizadas" },
];

/* ---------------------------------------------------------------------------
 * Página
 * ------------------------------------------------------------------------- */

export default function ReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [pestana, setPestana] = useState<FiltroPestana>("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const [reservaCheckIn, setReservaCheckIn] = useState<Reserva | null>(null);
  const [reservaCuenta, setReservaCuenta] = useState<Reserva | null>(null);
  const [reservaHuespedes, setReservaHuespedes] = useState<Reserva | null>(null);
  const [reservaEditar, setReservaEditar] = useState<Reserva | null>(null);
  const [reservaCancelar, setReservaCancelar] = useState<Reserva | null>(null);
  const [reservaConfirmar, setReservaConfirmar] = useState<Reserva | null>(null);

  const cargar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    setError(null);
    try {
      const estado = pestana === "TODAS" ? undefined : pestana;
      const data = await getReservas({ estado }, { signal });
      if (signal?.aborted) return;
      setReservas(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las reservas.");
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana]);

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  // El endpoint todavía no tiene ?search=: se filtra sobre lo ya traído,
  // igual que hace /proveedores/comprobantes con su buscador.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return reservas;
    return reservas.filter((r) =>
      `${r.reservation_code} ${r.guest.first_name} ${r.guest.last_name} ${r.guest.document_number} ${r.room.room_number} ${origenReserva(r.reservation_source)}`
        .toLowerCase()
        .includes(q),
    );
  }, [reservas, busqueda]);
  const porPagina = 10;
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const reservasPagina = visibles.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const actualizarFila = (actualizada: Reserva) => {
    setReservas((prev) => prev.map((r) => r.reservation_id === actualizada.reservation_id ? {
      ...r,
      ...actualizada,
      monto_abonado: actualizada.monto_abonado ?? r.monto_abonado,
      saldo_alojamiento: actualizada.saldo_alojamiento ?? r.saldo_alojamiento,
      medios_pago: actualizada.medios_pago ?? r.medios_pago,
      pago_prueba: actualizada.pago_prueba ?? r.pago_prueba,
    } : r));
  };

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Reservas"
        descripcion=""
        acciones={
          <Link href="/reservas/nueva">
            <Button>Registrar nueva reserva</Button>
          </Link>
        }
      />

      <Card>
        <div className="mb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bone/40 p-1">
            {PESTANAS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => { setPestana(p.valor); setPagina(1); }}
                aria-current={pestana === p.valor ? "true" : undefined}
                className={
                  pestana === p.valor
                    ? "rounded-md bg-carbon px-3.5 py-1.5 text-xs font-medium text-bone shadow-sm"
                    : "rounded-md px-3.5 py-1.5 text-xs font-medium text-carbon/60 hover:bg-white hover:text-carbon"
                }
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <Input
            type="search"
            placeholder="Buscar por código, huésped, documento, habitación u origen"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            className="max-w-sm"
          />
        </div>

        {mensaje && (
          <div className="mb-4">
            <InfoBox tipo="exito">{mensaje}</InfoBox>
          </div>
        )}
        {error && (
          <div className="mb-4">
            <InfoBox tipo="error">
              {error}{" "}
              <button type="button" onClick={() => cargar()} className="underline underline-offset-2">
                Reintentar
              </button>
            </InfoBox>
          </div>
        )}

        {cargando ? (
          <p className="py-10 text-center text-sm text-carbon/50">Cargando reservas…</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            titulo="No hay reservas para mostrar"
            descripcion={
              reservas.length === 0
                ? "No hay reservas registradas con este filtro. Probá otra pestaña o registrá una nueva reserva."
                : "Ninguna reserva coincide con la búsqueda."
            }
            accion={
              reservas.length === 0 ? (
                <Link href="/reservas/nueva">
                  <Button>Registrar la primera</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
          <Table className="!min-w-0 table-fixed [&_th]:px-2 [&_td]:px-2">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[22%]" />
              <col className="w-[8%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[17%]" />
            </colgroup>
            <THead>
              <TH className="whitespace-nowrap">Código / Origen</TH>
              <TH className="whitespace-nowrap">Huésped</TH>
              <TH className="whitespace-nowrap">Habitación</TH>
              <TH className="whitespace-nowrap">Estadía</TH>
              <TH className="whitespace-nowrap">Estado</TH>
              <TH className="whitespace-nowrap text-center">Acciones</TH>
            </THead>
            <TBody>
              {reservasPagina.map((r) => (
                <TR key={r.reservation_id}>
                  <TD className="whitespace-nowrap">
                    <span className="inline-flex rounded-md border border-line bg-bone/45 px-2 py-1 font-mono text-[11px] tracking-tight text-carbon/80">{r.reservation_code}</span>
                    <span className={`mt-1 block text-[11px] ${r.reservation_source === "WEB" ? "font-semibold text-[#56725c]" : "text-carbon/50"}`}>
                      {origenReserva(r.reservation_source)}
                    </span>
                  </TD>
                  <TD className="text-xs leading-5">
                    <span className="block font-semibold text-carbon">
                      {r.guest.last_name}, {r.guest.first_name}
                    </span>
                    <span className="text-[11px] text-carbon/50">
                      {r.guest.document_type} · {r.guest.document_number}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap"><span className="inline-flex min-w-10 justify-center rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold tabular-nums text-carbon">{r.room.room_number}</span></TD>
                  <TD className="text-xs tabular-nums">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><span className="w-12 text-[10px] uppercase tracking-wide text-carbon/45">Entrada</span><span className="font-medium text-carbon">{formatearFecha(r.check_in_date)}</span></div>
                      <div className="flex items-center gap-2"><span className="w-12 text-[10px] uppercase tracking-wide text-carbon/45">Salida</span><span className="text-carbon/65">{formatearFecha(r.check_out_date)}{r.estimated_departure_time && ` · ${new Date(r.estimated_departure_time).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`}</span></div>
                    </div>
                  </TD>
                  <TD className="align-middle">
                    <Badge tono={tonoPorEstado[r.reservation_status]}>{etiquetaEstado[r.reservation_status]}</Badge>
                    {r.reservation_status === "PENDIENTE" && r.pending_expires_at && (
                      <span className="mt-1 block text-[10px] tabular-nums text-carbon/50">
                        Vence {new Date(r.pending_expires_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    )}
                    {(r.monto_abonado ?? 0) > 0.001 && <div className="mt-2 space-y-1 text-[11px] leading-4">
                      <span className={`block font-semibold ${(r.saldo_alojamiento ?? 0) <= 0.001 ? "text-[#365b3b]" : "text-[#805500]"}`}>
                        {(r.saldo_alojamiento ?? 0) <= 0.001 ? "Alojamiento pagado" : `Pago parcial · saldo ${formatoMoneda(r.saldo_alojamiento ?? 0)}`}
                      </span>
                      <span className="block text-carbon/80">{r.medios_pago} · {formatoMoneda(r.monto_abonado ?? 0)}</span>
                    </div>}
                  </TD>
                  <TD className="align-middle !text-center">
                    <div className="flex items-center justify-center">
                      <MenuAcciones
                        reserva={r}
                        onConfirmar={() => setReservaConfirmar(r)}
                        onEditar={() => setReservaEditar(r)}
                        onCancelar={() => setReservaCancelar(r)}
                        onCheckIn={() => setReservaCheckIn(r)}
                        onHuespedes={() => setReservaHuespedes(r)}
                        onCuenta={() => setReservaCuenta(r)}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-carbon/60">
            <span>
              {visibles.length === 0 ? "Sin resultados" : `Mostrando ${(paginaActual - 1) * porPagina + 1}–${Math.min(paginaActual * porPagina, visibles.length)} de ${visibles.length} reservas`}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" tamano="sm" variante="secundario" disabled={paginaActual <= 1} onClick={() => setPagina((actual) => Math.max(1, actual - 1))}>
                Anterior
              </Button>
              <span className="min-w-24 text-center tabular-nums">Página {paginaActual} de {totalPaginas}</span>
              <Button type="button" tamano="sm" variante="secundario" disabled={paginaActual >= totalPaginas} onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}>
                Siguiente
              </Button>
            </div>
          </div>
          </>
        )}
      </Card>

      {reservaCheckIn && (
        <ModalCheckIn
          reserva={reservaCheckIn}
          onCerrar={() => setReservaCheckIn(null)}
          onExito={(actualizada) => {
            actualizarFila(actualizada);
            setReservaCheckIn(null);
            setMensaje(`Check-in registrado. Habitación ${actualizada.room.room_number} ocupada.`);
          }}
        />
      )}

      {reservaCuenta && (
        <ModalCuentaEstadia
          reserva={reservaCuenta}
          onCerrar={() => setReservaCuenta(null)}
          onCheckout={(actualizada, conSaldoPendiente) => {
            actualizarFila(actualizada);
            setReservaCuenta(null);
            setMensaje(
              (actualizada.check_out_pending_charges ?? conSaldoPendiente)
                ? "Check-out registrado. Atención: la estadía quedó con saldo pendiente de facturar/cobrar."
                : "Check-out registrado correctamente.",
            );
          }}
          onPagoRegistrado={() => setMensaje(`Cuenta actualizada para ${reservaCuenta.reservation_code}.`)}
        />
      )}

      {reservaHuespedes && (
        <ModalHuespedesEstadia
          reserva={reservaHuespedes}
          onCerrar={() => setReservaHuespedes(null)}
        />
      )}

      {reservaEditar && (
        <ModalEditarReserva
          reserva={reservaEditar}
          onCerrar={() => setReservaEditar(null)}
          onExito={(actualizada) => {
            actualizarFila(actualizada);
            setReservaEditar(null);
            setMensaje(`La reserva ${actualizada.reservation_code} fue modificada.`);
          }}
        />
      )}

      {reservaCancelar && (
        <ModalCancelarReserva
          reserva={reservaCancelar}
          onCerrar={() => setReservaCancelar(null)}
          onExito={(actualizada) => {
            actualizarFila(actualizada);
            setReservaCancelar(null);
            setMensaje(`La reserva ${actualizada.reservation_code} fue cancelada.`);
          }}
        />
      )}

      {reservaConfirmar && (
        <ModalConfirmarReserva
          reserva={reservaConfirmar}
          onCerrar={() => setReservaConfirmar(null)}
          onExito={(actualizada) => {
            actualizarFila(actualizada);
            setReservaConfirmar(null);
            setMensaje(`La reserva ${actualizada.reservation_code} quedó confirmada.`);
          }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Menú de acciones por fila.
 * Se dibuja en document.body con position: fixed, así no lo recorta el
 * overflow de la tabla/tarjeta (antes se cortaba en las últimas filas).
 * Si abajo no hay lugar, se abre hacia arriba.
 * ------------------------------------------------------------------------- */

const ANCHO_MENU = 176; // w-44

function MenuAcciones({
  reserva: r,
  onConfirmar,
  onEditar,
  onCancelar,
  onCheckIn,
  onHuespedes,
  onCuenta,
}: {
  reserva: Reserva;
  onConfirmar: () => void;
  onEditar: () => void;
  onCancelar: () => void;
  onCheckIn: () => void;
  onHuespedes: () => void;
  onCuenta: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calcularPosicion = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const altoMenu = menuRef.current?.offsetHeight ?? 260;
    const margen = 8;

    // Centrado bajo el botón, sin salirse de la pantalla
    const centrado = rect.left + rect.width / 2 - ANCHO_MENU / 2;
    const left = Math.max(margen, Math.min(centrado, window.innerWidth - ANCHO_MENU - margen));

    // Abre hacia abajo; si no entra, abre hacia arriba
    let top = rect.bottom + 6;
    if (top + altoMenu > window.innerHeight - margen) {
      top = Math.max(margen, rect.top - altoMenu - 6);
    }
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (abierto) calcularPosicion();
    else setPos(null);
  }, [abierto, calcularPosicion]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const ejecutar = (accion: () => void) => () => {
    setAbierto(false);
    accion();
  };

  const estado = r.reservation_status;
  if (!["PENDIENTE", "CONFIRMADA", "IN_HOUSE", "FINALIZADA"].includes(estado)) {
    return <span className="whitespace-nowrap text-xs text-carbon/45">Sin acciones</span>;
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Acciones para reserva ${r.reservation_code}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`flex h-9 w-10 cursor-pointer items-center justify-center rounded-md border bg-white text-lg leading-none shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon ${
          abierto
            ? "border-gold bg-bone text-carbon ring-2 ring-gold/40"
            : "border-line text-carbon/70 hover:bg-bone hover:text-carbon"
        }`}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {abierto &&
        createPortal(
          <>
            {/* Telón invisible para cerrar al hacer clic afuera */}
            <div className="fixed inset-0 z-[60] cursor-default" onClick={() => setAbierto(false)} />

            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                width: ANCHO_MENU,
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-[70] flex flex-col gap-1 rounded-lg border border-line bg-white p-1.5 text-left shadow-lg"
            >
              {estado === "PENDIENTE" && (
                <Button tamano="sm" className="w-full justify-start" onClick={ejecutar(onConfirmar)} aria-label={`Confirmar reserva ${r.reservation_code}`}>
                  Confirmar
                </Button>
              )}
              {["PENDIENTE", "CONFIRMADA"].includes(estado) && (
                <>
                  <Button tamano="sm" variante="secundario" className="w-full justify-start" onClick={ejecutar(onEditar)} aria-label={`Modificar reserva ${r.reservation_code}`}>
                    Modificar
                  </Button>
                  <Button tamano="sm" variante="peligro" className="w-full justify-start" onClick={ejecutar(onCancelar)} aria-label={`Cancelar reserva ${r.reservation_code}`}>
                    Cancelar reserva
                  </Button>
                </>
              )}
              {estado === "CONFIRMADA" && yaLlegoLaFecha(r.check_in_date) && (
                <Button tamano="sm" className="w-full justify-start" onClick={ejecutar(onCheckIn)} aria-label={`Registrar check-in de ${r.reservation_code}`}>
                  Check-in
                </Button>
              )}
              {estado === "IN_HOUSE" && (
                <Button tamano="sm" variante="secundario" className="w-full justify-start" onClick={ejecutar(onHuespedes)} aria-label={`Ver huéspedes de ${r.reservation_code}`}>
                  Huéspedes
                </Button>
              )}
              {["CONFIRMADA", "IN_HOUSE", "FINALIZADA"].includes(estado) && (
                <Button tamano="sm" className="w-full justify-start" onClick={ejecutar(onCuenta)} aria-label={`Abrir cuenta de ${r.reservation_code}`}>
                  {estado === "IN_HOUSE" ? "Cuenta y check-out" : "Cuenta"}
                </Button>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function ModalHuespedesEstadia({ reserva, onCerrar }: { reserva: Reserva; onCerrar: () => void }) {
  const [huespedes, setHuespedes] = useState<NonNullable<Reserva["stay_guests"]>>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get<Reserva>(`/reservas/${reserva.reservation_id}`)
      .then((detalle) => { if (vigente) setHuespedes(detalle.stay_guests ?? []); })
      .catch((err) => { if (vigente) setError(err instanceof ApiError ? err.message : "No se pudieron consultar los huéspedes de la estadía."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reserva.reservation_id]);

  const adultos = huespedes.filter((h) => h.person_type === "ADULTO").length;
  const menores = huespedes.filter((h) => h.person_type === "MENOR").length;

  return (
    <ModalShell titulo={`Huéspedes — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-carbon/70">
          <span>Habitación <strong className="text-carbon">{reserva.room.room_number}</strong></span>
          {!cargando && !error && <span>{adultos} adultos · {menores} menores</span>}
        </div>
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        {cargando ? (
          <p className="py-8 text-center text-sm text-carbon/55">Cargando huéspedes…</p>
        ) : error ? null : huespedes.length === 0 ? (
          <EmptyState titulo="No hay huéspedes registrados" descripcion="Esta estadía no tiene un registro de check-in con huéspedes guardado." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white px-4">
            {huespedes.map((huesped) => (
              <li key={huesped.stay_guest_id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="text-sm">
                      <span className="block font-medium text-carbon">{huesped.last_name}, {huesped.first_name}</span>
                      <span className="text-xs text-carbon/50">{huesped.guest_role === "TITULAR" ? "Titular" : "Acompañante"} · {huesped.document_type} {huesped.document_number}</span>
                </div>
                <Badge tono={huesped.person_type === "ADULTO" ? "info" : "activo"}>{huesped.person_type === "ADULTO" ? "Adulto" : "Menor"}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button type="button" variante="secundario" onClick={onCerrar}>Cerrar</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalEditarReserva({ reserva, onCerrar, onExito }: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva) => void;
}) {
  const [checkIn, setCheckIn] = useState(reserva.check_in_date.slice(0, 10));
  const [checkOut, setCheckOut] = useState(reserva.check_out_date.slice(0, 10));
  const [roomId, setRoomId] = useState(String(reserva.room_id));
  const [habitaciones, setHabitaciones] = useState<Array<{ room_id: number; room_number: string; room_type: { room_type_name: string } }>>([]);
  const [employeeId] = useState(leerEmployeeId);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<typeof habitaciones>("/reservas/habitaciones")
      .then((data) => setHabitaciones(
        data.some((h) => h.room_id === reserva.room_id)
          ? data
          : [...data, { room_id: reserva.room_id, room_number: reserva.room.room_number, room_type: { room_type_name: "Habitación actual" } }],
      ))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar las habitaciones."));
  }, []);

  const guardar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!checkIn || !checkOut || checkOut <= checkIn || !roomId) {
      setError("Ingresá fechas válidas y una habitación.");
      return;
    }
    setEnviando(true);
    try {
      const actualizada = await api.patch<Reserva>(`/reservas/${reserva.reservation_id}`, {
        checkIn, checkOut, roomId: Number(roomId), usuarioRecepcionId: Number(employeeId),
      });
      onExito(actualizada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo modificar la reserva.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell titulo={`Modificar reserva — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate className="space-y-4">
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        <Field label="Habitación" htmlFor="mod-res-habitacion" requerido>
          <Select id="mod-res-habitacion" value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={enviando}>
            {habitaciones.map((h) => <option key={h.room_id} value={h.room_id}>{h.room_number} · {h.room_type.room_type_name}</option>)}
          </Select>
        </Field>
        <FieldGrid>
          <Field label="Fecha de ingreso" htmlFor="mod-res-ingreso" requerido>
            <Input id="mod-res-ingreso" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} disabled={enviando} />
          </Field>
          <Field label="Fecha de egreso" htmlFor="mod-res-egreso" requerido>
            <Input id="mod-res-egreso" type="date" min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={enviando} />
          </Field>
        </FieldGrid>
        <div className="flex justify-end gap-3">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
          <Button type="submit" cargando={enviando}>Guardar cambios</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalCancelarReserva({ reserva, onCerrar, onExito }: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    if (!motivo.trim()) return setError("El motivo de cancelación es obligatorio.");
    setEnviando(true);
    setError(null);
    try {
      const actualizada = await api.post<Reserva>(`/reservas/${reserva.reservation_id}/cancelar`, {
        reason: motivo.trim(), usuarioRecepcionId: Number(leerEmployeeId()),
      });
      onExito(actualizada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la reserva.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell titulo={`Cancelar reserva — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate className="space-y-4">
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        <p className="text-sm text-carbon/70">Esta acción libera la habitación para las fechas de la reserva.</p>
        <Field label="Motivo de cancelación" htmlFor="motivo-cancelacion" requerido>
          <Input id="motivo-cancelacion" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} disabled={enviando} />
        </Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
          <Button type="submit" cargando={enviando}>Confirmar cancelación</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalConfirmarReserva({ reserva, onCerrar, onExito }: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const actualizada = await api.post<Reserva>(`/reservas/${reserva.reservation_id}/confirmar`, {
        usuarioRecepcionId: Number(leerEmployeeId()),
      });
      onExito(actualizada);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar la reserva.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <ModalShell titulo={`Confirmar reserva — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        <p className="text-sm text-carbon/70">
          Confirmá cuando el huésped haya aceptado la estadía o completado la seña. La reserva pendiente vence a las 24 horas si no se confirma.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>Volver</Button>
          <Button type="button" cargando={enviando} onClick={confirmar}>Confirmar reserva</Button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------------
 * Modal de confirmación — Check-in (RES-09)
 * ------------------------------------------------------------------------- */

interface AcompananteForm {
  personType: "ADULTO" | "MENOR";
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
}

const nuevoAcompanante = (personType: "ADULTO" | "MENOR"): AcompananteForm => ({
  personType,
  documentType: "DNI",
  documentNumber: "",
  firstName: "",
  lastName: "",
});

function ModalCheckIn({
  reserva,
  onCerrar,
  onExito,
}: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva) => void;
}) {
  const [adultos, setAdultos] = useState<number>(reserva.adults || 1);
  const [menores, setMenores] = useState<number>(reserva.children || 0);

  // Acompañantes requeridos: (adultos - 1 titular) + menores
  const [companeros, setCompaneros] = useState<AcompananteForm[]>(() => {
    const adultosExtra = Math.max(0, (reserva.adults || 1) - 1);
    const menoresTotales = Math.max(0, reserva.children || 0);
    return [
      ...Array.from({ length: adultosExtra }, () => nuevoAcompanante("ADULTO")),
      ...Array.from({ length: menoresTotales }, () => nuevoAcompanante("MENOR")),
    ];
  });

  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ajusta la cantidad de filas cuando recepción cambia adultos o menores
  const actualizarAdultos = (nuevoTotal: number) => {
    const cant = Math.max(1, Number.isFinite(nuevoTotal) ? nuevoTotal : 1);
    setAdultos(cant);
    setCompaneros((prev) => {
      const menoresActuales = prev.filter((c) => c.personType === "MENOR");
      const adultosActuales = prev.filter((c) => c.personType === "ADULTO");
      const objetivo = cant - 1; // 1 es el titular
      const nuevosAdultos =
        adultosActuales.length < objetivo
          ? [...adultosActuales, ...Array.from({ length: objetivo - adultosActuales.length }, () => nuevoAcompanante("ADULTO"))]
          : adultosActuales.slice(0, objetivo);
      return [...nuevosAdultos, ...menoresActuales];
    });
  };

  const actualizarMenores = (nuevoTotal: number) => {
    const cant = Math.max(0, Number.isFinite(nuevoTotal) ? nuevoTotal : 0);
    setMenores(cant);
    setCompaneros((prev) => {
      const adultosActuales = prev.filter((c) => c.personType === "ADULTO");
      const menoresActuales = prev.filter((c) => c.personType === "MENOR");
      const nuevosMenores =
        menoresActuales.length < cant
          ? [...menoresActuales, ...Array.from({ length: cant - menoresActuales.length }, () => nuevoAcompanante("MENOR"))]
          : menoresActuales.slice(0, cant);
      return [...adultosActuales, ...nuevosMenores];
    });
  };

  const modificarCompanero = (index: number, cambios: Partial<AcompananteForm>) =>
    setCompaneros((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));

  const totalPersonas = adultos + menores;

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    for (let i = 0; i < companeros.length; i++) {
      const c = companeros[i];
      if (!c.documentNumber.trim() || !c.firstName.trim() || !c.lastName.trim()) {
        setError(`Completá todos los datos obligatorios del acompañante #${i + 1}.`);
        return;
      }
    }

    setEnviando(true);
    try {
      const actualizada = await checkInReserva(reserva.reservation_id, {
        actualAdults: adultos,
        actualChildren: menores,
        guests: companeros.map((c) => ({
          personType: c.personType,
          documentType: c.documentType.trim().toUpperCase(),
          documentNumber: c.documentNumber.trim(),
          firstName: c.firstName.trim(),
          lastName: c.lastName.trim(),
        })),
        observations: observaciones.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      onExito(actualizada);
    } catch (err) {
      // 409 típico: la reserva ya tuvo check-in, o la fecha todavía no llegó.
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el check-in.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4">
          <div>
            <h2 className="font-serif text-lg text-carbon">Check-in · {reserva.reservation_code}</h2>
            <p className="text-xs text-carbon/60">
              Habitación {reserva.room.room_number} · Capacidad total a registrar: {totalPersonas} personas
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
          >
            ×
          </button>
        </div>

        <form onSubmit={confirmar} noValidate className="space-y-5 p-6">
          {error && <InfoBox tipo="error">{error}</InfoBox>}

          {/* Titular */}
          <div className="rounded-lg border border-line bg-bone/30 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-carbon/50">
              Huésped Titular (Adulto 1)
            </span>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-carbon">
              <span className="font-medium">
                {reserva.guest.first_name} {reserva.guest.last_name}
              </span>
              <span className="text-xs text-carbon/60">
                {reserva.guest.document_type} {reserva.guest.document_number}
              </span>
            </div>
          </div>

          {/* Cantidades */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Total Adultos" htmlFor="ci-adultos" requerido>
              <Input
                id="ci-adultos"
                type="number"
                min={1}
                value={adultos}
                disabled={enviando}
                onChange={(e) => actualizarAdultos(Number(e.target.value))}
              />
            </Field>
            <Field label="Total Menores" htmlFor="ci-menores" requerido>
              <Input
                id="ci-menores"
                type="number"
                min={0}
                value={menores}
                disabled={enviando}
                onChange={(e) => actualizarMenores(Number(e.target.value))}
              />
            </Field>
          </div>

          {/* Acompañantes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="text-sm font-semibold text-carbon">
                Huéspedes acompañantes a registrar ({companeros.length})
              </h3>
              <span className="text-xs text-carbon/50">
                Obligatorio para el registro legal de ocupantes
              </span>
            </div>

            {companeros.length === 0 ? (
              <p className="py-2 text-xs italic text-carbon/55">
                El titular ingresa solo a la habitación. No se requieren acompañantes.
              </p>
            ) : (
              companeros.map((huesped, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-line bg-white p-3.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-carbon">
                      Acompañante #{index + 1}
                    </span>
                    <Badge tono={huesped.personType === "ADULTO" ? "info" : "activo"}>
                      {huesped.personType === "ADULTO" ? "Adulto" : "Menor"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Tipo Documento" htmlFor={`doc-tipo-${index}`} requerido>
                      <Select
                        id={`doc-tipo-${index}`}
                        value={huesped.documentType}
                        disabled={enviando}
                        onChange={(e) => modificarCompanero(index, { documentType: e.target.value })}
                      >
                        <option value="DNI">DNI</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="CEDULA">Cédula</option>
                        <option value="LC">LC</option>
                        <option value="LE">LE</option>
                      </Select>
                    </Field>

                    <Field label="Número Documento" htmlFor={`doc-num-${index}`} requerido>
                      <Input
                        id={`doc-num-${index}`}
                        placeholder="Ej.: 40123456"
                        value={huesped.documentNumber}
                        disabled={enviando}
                        onChange={(e) => modificarCompanero(index, { documentNumber: e.target.value })}
                      />
                    </Field>

                    <Field label="Nombre" htmlFor={`nombre-${index}`} requerido>
                      <Input
                        id={`nombre-${index}`}
                        placeholder="Nombre completo"
                        value={huesped.firstName}
                        disabled={enviando}
                        onChange={(e) => modificarCompanero(index, { firstName: e.target.value })}
                      />
                    </Field>

                    <Field label="Apellido" htmlFor={`apellido-${index}`} requerido>
                      <Input
                        id={`apellido-${index}`}
                        placeholder="Apellido completo"
                        value={huesped.lastName}
                        disabled={enviando}
                        onChange={(e) => modificarCompanero(index, { lastName: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Observaciones */}
          <Field label="Observaciones de ingreso" htmlFor="ci-observaciones" ayuda="Opcional.">
            <textarea
              id="ci-observaciones"
              rows={2}
              value={observaciones}
              disabled={enviando}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas de recepción, equipaje o requerimientos especiales..."
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon placeholder:text-carbon/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:bg-bone/60"
            />
          </Field>

          <div className="flex justify-end gap-3 border-t border-line pt-3">
            <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              Confirmar ingreso y registrar huéspedes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalCuentaEstadia({
  reserva,
  onCerrar,
  onCheckout,
  onPagoRegistrado,
}: {
  reserva: Reserva;
  onCerrar: () => void;
  onCheckout: (actualizada: Reserva, conSaldoPendiente: boolean) => void;
  onPagoRegistrado: () => void;
}) {
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [metodoId, setMetodoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [importeAlojamiento, setImporteAlojamiento] = useState("");
  const [decisionCuenta, setDecisionCuenta] = useState<"COBRAR" | "PENDIENTE" | null>(null);
  const [detalleSaldo, setDetalleSaldo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargoEnProceso, setCargoEnProceso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargarCuenta = useCallback(async () => {
    const estado = await api.get<EstadoCuenta>(`/reservas/${reserva.reservation_id}/cuenta`);
    setCuenta(estado);
    setImporteAlojamiento(estado.saldo_alojamiento > 0 ? estado.saldo_alojamiento.toFixed(2) : "");
    return estado;
  }, [reserva.reservation_id]);

  useEffect(() => {
    let vigente = true;
    recargarCuenta()
      .catch((err) => { if (vigente) setError(err instanceof ApiError ? err.message : "No se pudo consultar la cuenta de la estadía."); })
      .finally(() => { if (vigente) setCargando(false); });
    api.get<MetodoPago[]>("/metodos-pago?activos=true")
      .then((formas) => {
        if (!vigente) return;
        const activas = formas.filter((forma) => forma.active);
        setMetodos(activas);
        setMetodoId(String(activas[0]?.payment_method_id ?? ""));
      })
      .catch((err) => { if (vigente) setError(err instanceof ApiError ? err.message : "No se pudieron cargar los medios de pago."); });
    return () => { vigente = false; };
  }, [recargarCuenta]);

  const formaSeleccionada = metodos.find((forma) => String(forma.payment_method_id) === metodoId);
  const cargosPendientes = cuenta?.cargos.filter((cargo) => !cargo.paid_at) ?? [];
  const puedeCobrar = reserva.reservation_status === "IN_HOUSE" || reserva.reservation_status === "FINALIZADA";

  const registrarPagoAlojamiento = async (event: FormEvent) => {
    event.preventDefault();
    if (!cuenta) return;
    const importe = Number(importeAlojamiento);
    if (!formaSeleccionada || !Number.isFinite(importe) || importe <= 0 || importe > cuenta.saldo_alojamiento) {
      setError("Ingresá un importe válido que no supere el saldo de alojamiento.");
      return;
    }
    if (formaSeleccionada.requires_reference && !referencia.trim()) {
      setError("Este medio de pago requiere número de referencia.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/reservas/${reserva.reservation_id}/pagos-alojamiento`, {
        amount: importe,
        paymentMethodId: formaSeleccionada.payment_method_id,
        paymentReference: referencia.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      await recargarCuenta();
      setReferencia("");
      onPagoRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago de alojamiento.");
    } finally {
      setGuardando(false);
    }
  };

  const cobrarConsumo = async (cargo: CargoPendiente) => {
    if (!formaSeleccionada) { setError("Elegí el medio de pago para cobrar el consumo."); return; }
    if (formaSeleccionada.requires_reference && !referencia.trim()) { setError("Este medio de pago requiere número de referencia."); return; }
    setCargoEnProceso(cargo.charge_id);
    setError(null);
    try {
      await api.patch(`/servicios-habitacion/cargos/${cargo.charge_id}/cobrar`, {
        paymentMethodId: formaSeleccionada.payment_method_id,
        paymentReference: referencia.trim() || undefined,
        usuarioRecepcionId: leerEmployeeId(),
      });
      await recargarCuenta();
      setReferencia("");
      onPagoRegistrado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cobrar el consumo.");
    } finally {
      setCargoEnProceso(null);
    }
  };

  const confirmarCheckOut = async (event: FormEvent) => {
    event.preventDefault();
    if (!cuenta) return;
    const tieneSaldo = cuenta.saldo_total > 0.001;
    if (tieneSaldo && !decisionCuenta) { setError("Indicá cómo cerrar el saldo pendiente de la cuenta."); return; }
    if (tieneSaldo && decisionCuenta === "PENDIENTE" && !detalleSaldo.trim()) { setError("Indicá el motivo por el que la cuenta queda pendiente."); return; }
    if (tieneSaldo && decisionCuenta === "COBRAR" && !formaSeleccionada) { setError("Elegí el medio de pago para cerrar la cuenta."); return; }
    if (tieneSaldo && decisionCuenta === "COBRAR" && formaSeleccionada?.requires_reference && !referencia.trim()) { setError("Este medio de pago requiere número de referencia."); return; }
    setGuardando(true);
    setError(null);
    try {
      const cobrarCuenta = decisionCuenta === "COBRAR";
      const actualizada = await checkOutReserva(reserva.reservation_id, {
        settleServiceCharges: cobrarCuenta,
        settleAccommodationBalance: cobrarCuenta,
        expectedAccommodationBalance: cuenta.saldo_alojamiento,
        serviceChargeIds: cargosPendientes.map((cargo) => cargo.charge_id),
        pendingDetail: decisionCuenta === "PENDIENTE" ? detalleSaldo.trim() : undefined,
        paymentMethodId: cobrarCuenta && tieneSaldo ? formaSeleccionada?.payment_method_id : undefined,
        paymentReference: cobrarCuenta ? referencia.trim() || undefined : undefined,
        observations: observaciones.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      onCheckout(actualizada, decisionCuenta === "PENDIENTE");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el check-out.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell titulo={`Cuenta de estadía · ${reserva.reservation_code}`} onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-5">
        <p className="text-sm text-carbon/70">{reserva.guest.last_name}, {reserva.guest.first_name} · Habitación {reserva.room.room_number}</p>
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        {cargando ? <p className="py-8 text-center text-sm text-carbon/50">Consultando alojamiento y consumos…</p> : cuenta && <>
          <section className="space-y-3 rounded-lg border border-line bg-bone/20 p-4" aria-labelledby="cuenta-resumen-title">
            <h3 id="cuenta-resumen-title" className="text-sm font-semibold text-carbon">Resumen completo</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md bg-white p-3"><span className="block text-[10px] uppercase text-carbon/50">Alojamiento</span><strong className="text-sm">{formatoMoneda(cuenta.total_alojamiento)}</strong><span className="mt-1 block text-[11px] text-carbon/55">Pagado {formatoMoneda(cuenta.abonado_alojamiento)}</span></div>
              <div className="rounded-md bg-white p-3"><span className="block text-[10px] uppercase text-carbon/50">Consumos</span><strong className="text-sm">{formatoMoneda(cuenta.total_consumos)}</strong><span className="mt-1 block text-[11px] text-carbon/55">Pagado {formatoMoneda(cuenta.consumos_abonados)}</span></div>
              <div className="rounded-md bg-white p-3"><span className="block text-[10px] uppercase text-carbon/50">Total de cuenta</span><strong className="text-sm">{formatoMoneda(cuenta.total_cuenta)}</strong><span className="mt-1 block text-[11px] text-carbon/55">Pagado {formatoMoneda(cuenta.total_abonado)}</span></div>
              <div className="rounded-md border border-warning/25 bg-warning/5 p-3"><span className="block text-[10px] uppercase text-carbon/50">Saldo pendiente</span><strong className="text-sm">{formatoMoneda(cuenta.saldo_total)}</strong></div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-carbon/60">Consumos y servicios</h4>
              {cuenta.cargos.length ? <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white px-3">
                {cuenta.cargos.map((cargo) => <li key={cargo.charge_id} className="py-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-medium text-carbon">{cargo.service_name}</p><p className="mt-1 text-carbon/55">Cantidad: {cargo.quantity} · {new Date(cargo.charged_at).toLocaleDateString("es-AR")}</p></div>
                    <div className="text-right"><p className="text-[10px] uppercase tracking-wide text-carbon/50">Precio por unidad</p><p className="mt-0.5 font-medium">{formatoMoneda(cargo.unit_price)}</p></div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2"><span className="text-carbon/65">Subtotal ({cargo.quantity} × {formatoMoneda(cargo.unit_price)})</span><span className="flex items-center gap-3"><strong>{formatoMoneda(cargo.total_amount)}</strong>{cargo.paid_at ? <span className="text-success">Cobrado{cargo.payment_method ? ` · ${cargo.payment_method}` : ""}</span> : puedeCobrar ? <Button tamano="sm" variante="secundario" onClick={() => void cobrarConsumo(cargo)} cargando={cargoEnProceso === cargo.charge_id} disabled={guardando || cargoEnProceso !== null}>Cobrar</Button> : <span className="text-warning">Pendiente</span>}</span></div>
                </li>)}
              </ul> : <p className="rounded-md border border-dashed border-line bg-white px-3 py-3 text-xs text-carbon/55">Todavía no hay consumos cargados a esta estadía.</p>}
            </div>
            {cuenta.pagos_alojamiento.length > 0 && <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-carbon/60">Pagos de alojamiento</h4>
              <ul className="max-h-28 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white px-3">
                {cuenta.pagos_alojamiento.map((pago) => <li key={pago.reservation_payment_id} className="flex justify-between gap-3 py-2 text-xs"><span>{new Date(pago.paid_at).toLocaleString("es-AR")} · {pago.payment_method}{detallePago(pago.payment_reference)}</span><strong>{formatoMoneda(pago.amount)}</strong></li>)}
              </ul>
            </div>}
          </section>

          {puedeCobrar && cuenta.saldo_alojamiento > 0.001 && <form onSubmit={registrarPagoAlojamiento} className="space-y-3 rounded-lg border border-line p-4">
            <div><h3 className="text-sm font-semibold">Registrar un pago de alojamiento</h3><p className="mt-1 text-xs text-carbon/55">Podés registrar un pago parcial sin cerrar la estadía.</p></div>
            <Field label="Importe" htmlFor="cuenta-pago-alojamiento" requerido><Input id="cuenta-pago-alojamiento" type="number" min="0.01" max={cuenta.saldo_alojamiento} step="0.01" value={importeAlojamiento} onChange={(e) => setImporteAlojamiento(e.target.value)} required disabled={guardando} /></Field>
            <Button type="submit" variante="secundario" cargando={guardando}>Registrar pago</Button>
          </form>}

          {(puedeCobrar && (cuenta.saldo_alojamiento > 0.001 || cargosPendientes.length > 0 || (reserva.reservation_status === "IN_HOUSE" && cuenta.saldo_total > 0.001))) && <section className="space-y-3 rounded-lg border border-line p-4">
            <h3 className="text-sm font-semibold">Medio de pago</h3>
            <Field label="Forma de pago" htmlFor="cuenta-metodo-pago" requerido><Select id="cuenta-metodo-pago" value={metodoId} onChange={(e) => { setMetodoId(e.target.value); setError(null); }} disabled={guardando || cargoEnProceso !== null}><option value="">Elegí medio de pago</option>{metodos.map((forma) => <option key={forma.payment_method_id} value={forma.payment_method_id}>{forma.payment_method}</option>)}</Select></Field>
            {formaSeleccionada?.requires_reference && <Field label="Referencia" htmlFor="cuenta-referencia" requerido><Input id="cuenta-referencia" value={referencia} onChange={(e) => { setReferencia(e.target.value); setError(null); }} maxLength={100} disabled={guardando || cargoEnProceso !== null} /></Field>}
          </section>}

          {reserva.reservation_status === "CONFIRMADA" && <p className="rounded-md border border-info/20 bg-info/5 p-3 text-xs text-carbon/70">El cobro se habilita al registrar el check-in.</p>}

          {reserva.reservation_status === "IN_HOUSE" && <form onSubmit={confirmarCheckOut} noValidate className="space-y-3 border-t border-line pt-4">
            <div><h3 className="text-sm font-semibold">Cerrar estadía</h3><p className="mt-1 text-xs text-carbon/55">El check-out cierra la cuenta y libera la habitación para limpieza.</p></div>
            {cuenta.saldo_total > 0.001 ? <div className="grid gap-2 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-md border px-3 py-3 text-sm ${decisionCuenta === "COBRAR" ? "border-gold bg-gold/10" : "border-line bg-white"}`}><input type="radio" name="decision-cuenta" checked={decisionCuenta === "COBRAR"} disabled={guardando} onChange={() => { setDecisionCuenta("COBRAR"); setError(null); }} className="mr-2 accent-gold" />Cobrar el saldo completo <strong className="block pl-6 pt-1">{formatoMoneda(cuenta.saldo_total)}</strong></label>
              <label className={`cursor-pointer rounded-md border px-3 py-3 text-sm ${decisionCuenta === "PENDIENTE" ? "border-warning bg-warning/10" : "border-line bg-white"}`}><input type="radio" name="decision-cuenta" checked={decisionCuenta === "PENDIENTE"} disabled={guardando} onChange={() => { setDecisionCuenta("PENDIENTE"); setError(null); }} className="mr-2 accent-gold" />Dejar el saldo pendiente</label>
            </div> : <p className="rounded-md border border-success/25 bg-success/5 p-3 text-sm text-success">La cuenta está saldada. Podés confirmar el check-out.</p>}
            {decisionCuenta === "PENDIENTE" && <Field label="Motivo del saldo pendiente" htmlFor="cuenta-detalle-saldo" requerido><Input id="cuenta-detalle-saldo" placeholder="Ej.: El huésped abonará por transferencia" value={detalleSaldo} maxLength={255} disabled={guardando} onChange={(e) => { setDetalleSaldo(e.target.value); setError(null); }} /></Field>}
            <Field label="Observaciones" htmlFor="cuenta-observaciones" ayuda="Opcional."><textarea id="cuenta-observaciones" rows={2} value={observaciones} disabled={guardando} onChange={(e) => setObservaciones(e.target.value)} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon placeholder:text-carbon/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:bg-bone/60" /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variante="secundario" onClick={onCerrar} disabled={guardando}>Cerrar</Button><Button type="submit" cargando={guardando}>Confirmar check-out</Button></div>
          </form>}
          {reserva.reservation_status !== "IN_HOUSE" && <div className="flex justify-end"><Button type="button" variante="secundario" onClick={onCerrar} disabled={guardando}>Cerrar</Button></div>}
        </>}
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------------
 * Envoltorio común de los modales (mismo patrón que la ficha de comprobante
 * en /proveedores/comprobantes/page.tsx: overlay + click afuera para cerrar).
 * ------------------------------------------------------------------------- */

function ModalShell({
  titulo,
  onCerrar,
  children,
  ancho = "max-w-md",
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: "max-w-md" | "max-w-2xl";
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className={`w-full ${ancho} max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-serif text-lg text-carbon">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
