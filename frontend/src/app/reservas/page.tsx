"use client";

/**
 * Grilla principal de reservas (RES-01, RES-09, RES-11).
 *
 * Es la pantalla de recepción: ver qué reservas hay, filtrar por estado, y
 * accionar el check-in / check-out del día. La creación de reservas sigue
 * viviendo en /reservas/nueva; esta pantalla no la reemplaza.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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

interface CargoPendiente {
  charge_id: number;
  service_name: string;
  quantity: number;
  unit_price: number | string;
  total_amount: number | string;
  charged_at: string;
  paid_at: string | null;
}
interface MetodoPago { payment_method_id: number; payment_method: string; requires_reference: boolean; active: boolean; }
interface PagoAlojamiento { reservation_payment_id: number; amount: number | string; paid_at: string; payment_reference: string | null; payment_method: string; employees_name: string; employees_lastname: string; }
interface ResumenPagosAlojamiento { reservation_id: number; total_alojamiento: number; abonado: number; saldo: number; pagos: PagoAlojamiento[]; }

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

  const [reservaCheckIn, setReservaCheckIn] = useState<Reserva | null>(null);
  const [reservaCheckOut, setReservaCheckOut] = useState<Reserva | null>(null);
  const [reservaHuespedes, setReservaHuespedes] = useState<Reserva | null>(null);
  const [reservaEditar, setReservaEditar] = useState<Reserva | null>(null);
  const [reservaCancelar, setReservaCancelar] = useState<Reserva | null>(null);
  const [reservaConfirmar, setReservaConfirmar] = useState<Reserva | null>(null);
  const [reservaPago, setReservaPago] = useState<Reserva | null>(null);

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
      `${r.reservation_code} ${r.guest.first_name} ${r.guest.last_name} ${r.guest.document_number} ${r.room.room_number}`
        .toLowerCase()
        .includes(q),
    );
  }, [reservas, busqueda]);

  const actualizarFila = (actualizada: Reserva) => {
    setReservas((prev) => prev.map((r) => (r.reservation_id === actualizada.reservation_id ? actualizada : r)));
  };

  return (
    <>
      <PageHeader
        eyebrow=""
        titulo="Reservas"
        descripcion=""
        acciones={
          <Link href="/reservas/nueva">
            <Button>Nueva reserva</Button>
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
                onClick={() => setPestana(p.valor)}
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
            placeholder="Buscar por código, huésped, documento o habitación"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
          <Table className="min-w-[76rem] table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[8%]" />
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[32%]" />
            </colgroup>
            <THead>
              <TH className="whitespace-nowrap">Código</TH>
              <TH className="whitespace-nowrap">Huésped</TH>
              <TH className="whitespace-nowrap">Habitación</TH>
              <TH className="whitespace-nowrap">Estadía</TH>
              <TH className="whitespace-nowrap">Estado</TH>
              <TH className="whitespace-nowrap text-right">Acciones</TH>
            </THead>
            <TBody>
              {visibles.map((r) => (
                <TR key={r.reservation_id}>
                  <TD className="whitespace-nowrap"><span className="inline-flex rounded-md border border-line bg-bone/45 px-2 py-1 font-mono text-[11px] tracking-tight text-carbon/80">{r.reservation_code}</span></TD>
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
                      <div className="flex items-center gap-2"><span className="w-12 text-[10px] uppercase tracking-wide text-carbon/45">Salida</span><span className="text-carbon/65">{formatearFecha(r.check_out_date)}</span></div>
                    </div>
                  </TD>
                  <TD className="align-middle">
                    <Badge tono={tonoPorEstado[r.reservation_status]}>{etiquetaEstado[r.reservation_status]}</Badge>
                    {r.reservation_status === "PENDIENTE" && r.pending_expires_at && (
                      <span className="mt-1 block text-[10px] tabular-nums text-carbon/50">
                        Vence {new Date(r.pending_expires_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex min-w-[20rem] flex-wrap justify-end gap-2">
                    {r.reservation_status === "PENDIENTE" && (
                      <Button tamano="sm" onClick={() => setReservaConfirmar(r)} aria-label={`Confirmar reserva ${r.reservation_code}`}>
                        Confirmar
                      </Button>
                    )}
                    {["PENDIENTE", "CONFIRMADA"].includes(r.reservation_status) && (
                      <>
                        <Button tamano="sm" variante="secundario" onClick={() => setReservaEditar(r)} aria-label={`Modificar reserva ${r.reservation_code}`}>
                          Modificar
                        </Button>{" "}
                        <Button tamano="sm" variante="peligro" onClick={() => setReservaCancelar(r)} aria-label={`Cancelar reserva ${r.reservation_code}`}>
                          Cancelar reserva
                        </Button>{" "}
                      </>
                    )}
                    {r.reservation_status === "CONFIRMADA" && yaLlegoLaFecha(r.check_in_date) && (
                      <Button tamano="sm" onClick={() => setReservaCheckIn(r)} aria-label={`Registrar check-in de ${r.reservation_code}`}>
                        Check-in
                      </Button>
                    )}
                    {r.reservation_status === "IN_HOUSE" && (
                      <>
                        <Button tamano="sm" variante="secundario" onClick={() => setReservaHuespedes(r)} aria-label={`Ver huéspedes de ${r.reservation_code}`}>
                          Huéspedes
                        </Button>
                        <Button tamano="sm" onClick={() => setReservaCheckOut(r)} aria-label={`Registrar check-out de ${r.reservation_code}`}>
                          Check-out
                        </Button>
                      </>
                    )}
                    {["IN_HOUSE", "FINALIZADA"].includes(r.reservation_status) && <Button tamano="sm" variante="secundario" onClick={() => setReservaPago(r)}>Cobros</Button>}
                    {!["PENDIENTE", "CONFIRMADA", "IN_HOUSE", "FINALIZADA"].includes(r.reservation_status) && (
                      <span className="pr-1 text-xs text-carbon/45">Sin acciones disponibles</span>
                    )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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

      {reservaCheckOut && (
        <ModalCheckOut
          reserva={reservaCheckOut}
          onCerrar={() => setReservaCheckOut(null)}
          onExito={(actualizada, conSaldoPendiente) => {
            actualizarFila(actualizada);
            setReservaCheckOut(null);
            setMensaje(
              (actualizada.check_out_pending_charges ?? conSaldoPendiente)
                ? "Check-out registrado. Atención: la estadía quedó con saldo pendiente de facturar/cobrar."
                : "Check-out registrado correctamente.",
            );
          }}
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
      {reservaPago && <ModalPagosAlojamiento reserva={reservaPago} onCerrar={() => setReservaPago(null)} onPagoRegistrado={() => setMensaje(`Pago de alojamiento registrado para ${reservaPago.reservation_code}.`)} />}
    </>
  );
}

function ModalPagosAlojamiento({ reserva, onCerrar, onPagoRegistrado }: { reserva: Reserva; onCerrar: () => void; onPagoRegistrado: () => void }) {
  const [resumen, setResumen] = useState<ResumenPagosAlojamiento | null>(null);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [importe, setImporte] = useState("");
  const [metodoId, setMetodoId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([
        api.get<ResumenPagosAlojamiento>(`/reservas/${reserva.reservation_id}/pagos-alojamiento`),
        api.get<MetodoPago[]>("/metodos-pago?activos=true"),
    ]).then(([estadoPago, formas]) => {
      if (!vigente) return;
      setResumen(estadoPago); setMetodos(formas.filter((m) => m.active));
      setMetodoId(String(formas.find((m) => m.active)?.payment_method_id ?? ""));
      setImporte(estadoPago.saldo > 0 ? estadoPago.saldo.toFixed(2) : "");
    }).catch((err) => {
      if (vigente) setError(err instanceof ApiError ? err.message : "No se pudo consultar el saldo de alojamiento.");
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reserva.reservation_id]);

  const registrar = async (event: FormEvent) => {
    event.preventDefault();
    if (!resumen) return;
    const forma = metodos.find((m) => String(m.payment_method_id) === metodoId);
    const valor = Number(importe);
    if (!forma || !Number.isFinite(valor) || valor <= 0 || valor > resumen.saldo) { setError("Ingresá un importe válido que no supere el saldo pendiente."); return; }
    if (forma.requires_reference && !referencia.trim()) { setError("Este medio de pago requiere número de referencia."); return; }
    setGuardando(true); setError(null);
    try {
      const actualizado = await api.post<ResumenPagosAlojamiento>(`/reservas/${reserva.reservation_id}/pagos-alojamiento`, {
        amount: valor, paymentMethodId: forma.payment_method_id, paymentReference: referencia.trim() || undefined, employeeId: leerEmployeeId(),
      });
      setResumen(actualizado); setImporte(actualizado.saldo > 0 ? actualizado.saldo.toFixed(2) : ""); setReferencia(""); onPagoRegistrado();
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago de alojamiento."); }
    finally { setGuardando(false); }
  };

  return <ModalShell titulo={`Cobros de alojamiento · ${reserva.reservation_code}`} onCerrar={onCerrar}>
    <div className="space-y-4">
      <p className="text-sm text-carbon/70">{reserva.guest.last_name}, {reserva.guest.first_name} · Habitación {reserva.room.room_number}</p>
      {error && <InfoBox tipo="error">{error}</InfoBox>}
      {cargando ? <p className="py-6 text-center text-sm text-carbon/50">Consultando pagos…</p> : resumen && <>
        <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-bone/45 p-2"><span className="block text-[10px] uppercase text-carbon/50">Total estadía</span><strong className="text-xs">{formatoMoneda(resumen.total_alojamiento)}</strong></div><div className="rounded-md bg-success/5 p-2"><span className="block text-[10px] uppercase text-carbon/50">Abonado</span><strong className="text-xs text-success">{formatoMoneda(resumen.abonado)}</strong></div><div className="rounded-md bg-warning/10 p-2"><span className="block text-[10px] uppercase text-carbon/50">Saldo</span><strong className="text-xs">{formatoMoneda(resumen.saldo)}</strong></div></div>
        {resumen.pagos.length > 0 && <section><h3 className="mb-2 text-sm font-semibold">Pagos registrados</h3><ul className="max-h-32 divide-y divide-line overflow-y-auto rounded-md border border-line px-3">{resumen.pagos.map((pago) => <li key={pago.reservation_payment_id} className="flex justify-between gap-3 py-2 text-xs"><span>{new Date(pago.paid_at).toLocaleString("es-AR")} · {pago.payment_method}{pago.payment_reference && ` · Ref. ${pago.payment_reference}`}</span><strong className="whitespace-nowrap">{formatoMoneda(pago.amount)}</strong></li>)}</ul></section>}
        {resumen.saldo > 0 ? <form onSubmit={registrar} className="space-y-3 border-t border-line pt-4"><h3 className="text-sm font-semibold">Registrar un pago</h3><FieldGrid><Field label="Importe" htmlFor="pago-alojamiento-importe" requerido><Input id="pago-alojamiento-importe" type="number" min="0.01" max={resumen.saldo} step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)} required disabled={guardando} /></Field><Field label="Medio de pago" htmlFor="pago-alojamiento-metodo" requerido><Select id="pago-alojamiento-metodo" value={metodoId} onChange={(e) => setMetodoId(e.target.value)} required disabled={guardando}><option value="">Elegí medio</option>{metodos.map((m) => <option key={m.payment_method_id} value={m.payment_method_id}>{m.payment_method}</option>)}</Select></Field></FieldGrid>{metodos.find((m) => String(m.payment_method_id) === metodoId)?.requires_reference && <Field label="Referencia" htmlFor="pago-alojamiento-ref" requerido><Input id="pago-alojamiento-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={100} required disabled={guardando} /></Field>}<div className="flex justify-end gap-2"><Button type="button" variante="secundario" onClick={onCerrar} disabled={guardando}>Cerrar</Button><Button type="submit" cargando={guardando}>Registrar pago</Button></div></form> : <div className="rounded-md border border-success/25 bg-success/5 p-3 text-sm text-success">Alojamiento abonado por completo.</div>}
      </>}
      {cargando && <div className="flex justify-end"><Button type="button" variante="secundario" onClick={onCerrar}>Cerrar</Button></div>}
    </div>
  </ModalShell>;
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

function ModalCheckIn({
  reserva,
  onCerrar,
  onExito,
}: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva) => void;
}) {
  const [adultos, setAdultos] = useState(String(reserva.adults));
  const [menores, setMenores] = useState(String(reserva.children));
  const [companeros, setCompaneros] = useState<Array<{ personType: "ADULTO" | "MENOR"; documentType: string; documentNumber: string; firstName: string; lastName: string }>>([]);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (companeros.some((h) => !h.documentNumber.trim() || !h.firstName.trim() || !h.lastName.trim())) {
      setError("Completá nombre, apellido y documento de cada huésped acompañante.");
      return;
    }
    if (companeros.filter((h) => h.personType === "ADULTO").length + 1 !== Number(adultos)
      || companeros.filter((h) => h.personType === "MENOR").length !== Number(menores)) {
      setError("La lista de huéspedes debe coincidir con la cantidad de adultos y menores. El titular cuenta como un adulto.");
      return;
    }
    setEnviando(true);
    try {
      const actualizada = await checkInReserva(reserva.reservation_id, {
        actualAdults: adultos ? Number(adultos) : undefined,
        actualChildren: menores ? Number(menores) : undefined,
        guests: companeros,
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
    <ModalShell titulo={`Check-in — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate className="space-y-4">
        <p className="text-sm text-carbon/70">
          {reserva.guest.last_name}, {reserva.guest.first_name} · Habitación {reserva.room.room_number}
        </p>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Adultos" htmlFor="ci-adultos">
            <Input
              id="ci-adultos"
              type="number"
              min={1}
              value={adultos}
              disabled={enviando}
              onChange={(e) => setAdultos(e.target.value)}
            />
          </Field>
          <Field label="Menores" htmlFor="ci-menores">
            <Input
              id="ci-menores"
              type="number"
              min={0}
              value={menores}
              disabled={enviando}
              onChange={(e) => setMenores(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-carbon">Huéspedes que ingresan</p>
              <p className="text-xs text-carbon/55">Titular: {reserva.guest.first_name} {reserva.guest.last_name} · {reserva.guest.document_type} {reserva.guest.document_number}</p>
            </div>
            <Button type="button" tamano="sm" variante="secundario" disabled={enviando} onClick={() => setCompaneros((prev) => [...prev, { personType: "ADULTO", documentType: "DNI", documentNumber: "", firstName: "", lastName: "" }])}>
              + Agregar huésped
            </Button>
          </div>
          {companeros.map((huesped, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <Field label={`Huésped ${index + 2}`} htmlFor={`ci-tipo-${index}`}>
                <Select id={`ci-tipo-${index}`} value={huesped.personType} disabled={enviando} onChange={(e) => setCompaneros((prev) => prev.map((item, i) => i === index ? { ...item, personType: e.target.value as "ADULTO" | "MENOR" } : item))}>
                  <option value="ADULTO">Adulto</option><option value="MENOR">Menor</option>
                </Select>
              </Field>
              <Field label="Tipo de documento" htmlFor={`ci-doc-tipo-${index}`}>
                <Select id={`ci-doc-tipo-${index}`} value={huesped.documentType} disabled={enviando} onChange={(e) => setCompaneros((prev) => prev.map((item, i) => i === index ? { ...item, documentType: e.target.value } : item))}>
                  <option value="DNI">DNI</option><option value="PASAPORTE">Pasaporte</option><option value="CEDULA">Cédula</option><option value="LC">LC</option><option value="LE">LE</option>
                </Select>
              </Field>
              <Field label="Documento" htmlFor={`ci-doc-${index}`} requerido>
                <Input id={`ci-doc-${index}`} value={huesped.documentNumber} disabled={enviando} onChange={(e) => setCompaneros((prev) => prev.map((item, i) => i === index ? { ...item, documentNumber: e.target.value } : item))} />
              </Field>
              <Field label="Nombre" htmlFor={`ci-nombre-${index}`} requerido>
                <Input id={`ci-nombre-${index}`} value={huesped.firstName} disabled={enviando} onChange={(e) => setCompaneros((prev) => prev.map((item, i) => i === index ? { ...item, firstName: e.target.value } : item))} />
              </Field>
              <Field label="Apellido" htmlFor={`ci-apellido-${index}`} requerido>
                <Input id={`ci-apellido-${index}`} value={huesped.lastName} disabled={enviando} onChange={(e) => setCompaneros((prev) => prev.map((item, i) => i === index ? { ...item, lastName: e.target.value } : item))} />
              </Field>
              <div className="flex items-end justify-end">
                <Button type="button" tamano="sm" variante="secundario" disabled={enviando} onClick={() => setCompaneros((prev) => prev.filter((_, i) => i !== index))}>Quitar</Button>
              </div>
            </div>
          ))}
        </div>

        <Field label="Observaciones" htmlFor="ci-observaciones" ayuda="Opcional.">
          <textarea
            id="ci-observaciones"
            rows={3}
            value={observaciones}
            disabled={enviando}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon placeholder:text-carbon/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:cursor-not-allowed disabled:bg-bone/60"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando}>
            Confirmar check-in
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------------
 * Modal de confirmación — Check-out (RES-11)
 * ------------------------------------------------------------------------- */

function ModalCheckOut({
  reserva,
  onCerrar,
  onExito,
}: {
  reserva: Reserva;
  onCerrar: () => void;
  onExito: (actualizada: Reserva, conSaldoPendiente: boolean) => void;
}) {
  const [cargos, setCargos] = useState<CargoPendiente[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [cargandoCargos, setCargandoCargos] = useState(true);
  const [errorConsultaCargos, setErrorConsultaCargos] = useState(false);
  const [decisionCargos, setDecisionCargos] = useState<"COBRAR" | "PENDIENTE" | null>(null);
  const [detalleSaldo, setDetalleSaldo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get<CargoPendiente[]>(`/servicios-habitacion/habitaciones/${reserva.room_id}/cargos?reservationId=${reserva.reservation_id}`)
      .then((data) => { if (vigente) setCargos(data.filter((cargo) => !cargo.paid_at)); })
      .catch((err) => { if (vigente) { setErrorConsultaCargos(true); setError(err instanceof ApiError ? err.message : "No se pudieron consultar los cargos de la estadía."); } })
      .finally(() => { if (vigente) setCargandoCargos(false); });
    return () => { vigente = false; };
  }, [reserva.reservation_id, reserva.room_id]);

  useEffect(() => {
    api.get<MetodoPago[]>("/metodos-pago?activos=true")
      .then((metodos) => { setMetodosPago(metodos); setMetodoPagoId(String(metodos[0]?.payment_method_id ?? "")); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar los medios de pago."));
  }, []);

  const totalCargosPendientes = cargos.reduce((total, cargo) => total + Number(cargo.total_amount), 0);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (cargandoCargos) return;
    if (cargos.length > 0 && !decisionCargos) {
      setError("Elegí si los cargos se registran como cobrados o quedan pendientes.");
      return;
    }
    if (cargos.length > 0 && decisionCargos === "PENDIENTE" && !detalleSaldo.trim()) {
      setError("Indicá el motivo por el que los cargos quedan pendientes.");
      return;
    }
    const metodoSeleccionado = metodosPago.find((m) => String(m.payment_method_id) === metodoPagoId);
    if (cargos.length > 0 && decisionCargos === "COBRAR" && !metodoSeleccionado) { setError("Elegí el medio de pago para los cargos de habitación."); return; }
    if (cargos.length > 0 && decisionCargos === "COBRAR" && metodoSeleccionado?.requires_reference && !referenciaPago.trim()) { setError("El medio de pago seleccionado requiere número de referencia."); return; }
    setEnviando(true);
    try {
      const actualizada = await checkOutReserva(reserva.reservation_id, {
        settleServiceCharges: decisionCargos === "COBRAR",
        paymentMethodId: decisionCargos === "COBRAR" ? Number(metodoPagoId) : undefined,
        paymentReference: decisionCargos === "COBRAR" ? referenciaPago.trim() || undefined : undefined,
        serviceChargeIds: cargos.map((cargo) => cargo.charge_id),
        pendingDetail: decisionCargos === "PENDIENTE" ? detalleSaldo.trim() : undefined,
        observations: observaciones.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      onExito(actualizada, decisionCargos === "PENDIENTE");
    } catch (err) {
      // 409 típico: la reserva todavía no tiene check-in registrado.
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el check-out.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell titulo={`Check-out — ${reserva.reservation_code}`} onCerrar={onCerrar}>
      <form onSubmit={confirmar} noValidate className="space-y-4">
        <p className="text-sm text-carbon/70">
          {reserva.guest.last_name}, {reserva.guest.first_name} · Habitación {reserva.room.room_number}
        </p>

        {error && <InfoBox tipo="error">{error}</InfoBox>}

        {cargandoCargos ? (
          <div className="rounded-lg border border-line bg-bone/30 px-4 py-3 text-sm text-carbon/60" role="status">
            Consultando el folio de la habitación…
          </div>
        ) : error && cargos.length === 0 ? null : cargos.length > 0 ? (
          <section className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4" aria-labelledby="checkout-cargos-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 id="checkout-cargos-title" className="text-sm font-semibold text-carbon">Cargos pendientes de la habitación</h3>
                <p className="mt-0.5 text-xs text-carbon/55">Revisá el folio y definí cómo cerrar estos consumos.</p>
              </div>
              <strong className="text-sm text-carbon">{formatoMoneda(totalCargosPendientes)}</strong>
            </div>
            <ul className="max-h-32 divide-y divide-line overflow-y-auto rounded-md border border-line bg-white px-3">
              {cargos.map((cargo) => (
                <li key={cargo.charge_id} className="flex justify-between gap-3 py-2 text-xs">
                  <span>{cargo.quantity} × {cargo.service_name} <span className="text-carbon/45">({formatoMoneda(cargo.unit_price)} c/u)</span></span>
                  <strong className="whitespace-nowrap">{formatoMoneda(cargo.total_amount)}</strong>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm ${decisionCargos === "COBRAR" ? "border-gold bg-gold/10" : "border-line bg-white"}`}>
                <input type="radio" name="checkout-cargos" value="COBRAR" checked={decisionCargos === "COBRAR"} disabled={enviando} onChange={() => { setDecisionCargos("COBRAR"); setError(null); }} className="mr-2 accent-gold" />
                Registrar como cobrados
              </label>
              <label className={`cursor-pointer rounded-md border px-3 py-2.5 text-sm ${decisionCargos === "PENDIENTE" ? "border-warning bg-warning/10" : "border-line bg-white"}`}>
                <input type="radio" name="checkout-cargos" value="PENDIENTE" checked={decisionCargos === "PENDIENTE"} disabled={enviando} onChange={() => { setDecisionCargos("PENDIENTE"); setError(null); }} className="mr-2 accent-gold" />
                Dejar pendiente
              </label>
            </div>
            {decisionCargos === "PENDIENTE" && (
              <Field label="Motivo del saldo pendiente" htmlFor="co-detalle" requerido>
                <Input id="co-detalle" placeholder="Ej.: El huésped abonará por transferencia" value={detalleSaldo} maxLength={255} disabled={enviando} onChange={(e) => { setDetalleSaldo(e.target.value); setError(null); }} />
              </Field>
            )}
            {decisionCargos === "COBRAR" && <FieldGrid>
              <Field label="Medio de pago" htmlFor="co-metodo-pago" requerido><Select id="co-metodo-pago" value={metodoPagoId} onChange={(e) => { setMetodoPagoId(e.target.value); setError(null); }} required disabled={enviando}><option value="">Elegí medio de pago</option>{metodosPago.filter((m) => m.active).map((m) => <option key={m.payment_method_id} value={m.payment_method_id}>{m.payment_method}</option>)}</Select></Field>
              {metodosPago.find((m) => String(m.payment_method_id) === metodoPagoId)?.requires_reference && <Field label="Referencia" htmlFor="co-referencia" requerido><Input id="co-referencia" value={referenciaPago} onChange={(e) => { setReferenciaPago(e.target.value); setError(null); }} maxLength={100} required disabled={enviando} /></Field>}
            </FieldGrid>}
          </section>
        ) : !error ? (
          <div className="rounded-lg border border-success/25 bg-success/5 px-4 py-3 text-sm text-carbon/75">
            No hay cargos de habitación pendientes. El folio está al día.
          </div>
        ) : null}

        <Field label="Observaciones" htmlFor="co-observaciones" ayuda="Opcional.">
          <textarea
            id="co-observaciones"
            rows={3}
            value={observaciones}
            disabled={enviando}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-carbon placeholder:text-carbon/35 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/60 disabled:cursor-not-allowed disabled:bg-bone/60"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando} disabled={cargandoCargos || errorConsultaCargos}>
            Confirmar check-out
          </Button>
        </div>
      </form>
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
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-white shadow-xl">
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
