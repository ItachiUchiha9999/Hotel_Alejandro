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
  Input,
  InfoBox,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { checkInReserva, checkOutReserva, getReservas, ApiError } from "@/lib/api";
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

type FiltroPestana = "TODAS" | "CONFIRMADA" | "IN_HOUSE" | "FINALIZADA";

const PESTANAS: Array<{ valor: FiltroPestana; etiqueta: string }> = [
  { valor: "TODAS", etiqueta: "Todas" },
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
        eyebrow="RES-01 · RES-09 · RES-11"
        titulo="Reservas"
        descripcion="Recepción: estado de cada reserva, check-in y check-out del día."
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
          <Table>
            <THead>
              <TH>Código</TH>
              <TH>Huésped</TH>
              <TH>Habitación</TH>
              <TH>Ingreso — Egreso</TH>
              <TH>Estado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <TBody>
              {visibles.map((r) => (
                <TR key={r.reservation_id}>
                  <TD className="font-mono text-xs">{r.reservation_code}</TD>
                  <TD className="text-xs">
                    <span className="block font-medium text-carbon">
                      {r.guest.last_name}, {r.guest.first_name}
                    </span>
                    <span className="text-carbon/50">
                      {r.guest.document_type} {r.guest.document_number}
                    </span>
                  </TD>
                  <TD className="text-xs font-medium">{r.room.room_number}</TD>
                  <TD className="text-xs">
                    {formatearFecha(r.check_in_date)} — {formatearFecha(r.check_out_date)}
                  </TD>
                  <TD>
                    <Badge tono={tonoPorEstado[r.reservation_status]}>{etiquetaEstado[r.reservation_status]}</Badge>
                  </TD>
                  <TD className="text-right">
                    {r.reservation_status === "CONFIRMADA" && yaLlegoLaFecha(r.check_in_date) && (
                      <Button tamano="sm" variante="secundario" onClick={() => setReservaCheckIn(r)}>
                        Check-in
                      </Button>
                    )}
                    {r.reservation_status === "IN_HOUSE" && (
                      <Button tamano="sm" variante="secundario" onClick={() => setReservaCheckOut(r)}>
                        Check-out
                      </Button>
                    )}
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
              conSaldoPendiente
                ? "Check-out registrado. Atención: la estadía quedó con saldo pendiente de facturar/cobrar."
                : "Check-out registrado correctamente.",
            );
          }}
        />
      )}
    </>
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
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const actualizada = await checkInReserva(reserva.reservation_id, {
        actualAdults: adultos ? Number(adultos) : undefined,
        actualChildren: menores ? Number(menores) : undefined,
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
  const [saldoPendiente, setSaldoPendiente] = useState(false);
  const [detalleSaldo, setDetalleSaldo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const actualizada = await checkOutReserva(reserva.reservation_id, {
        pendingCharges: saldoPendiente,
        pendingDetail: saldoPendiente ? detalleSaldo.trim() || undefined : undefined,
        observations: observaciones.trim() || undefined,
        employeeId: leerEmployeeId(),
      });
      onExito(actualizada, saldoPendiente);
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

        <label className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-3.5 py-3 text-sm text-carbon/85">
          <input
            type="checkbox"
            checked={saldoPendiente}
            disabled={enviando}
            onChange={(e) => setSaldoPendiente(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line text-gold focus:ring-gold/60"
          />
          <span>
            La estadía queda con <strong>consumos o saldo pendiente</strong> de facturar/cobrar.
            <br />
            <span className="text-xs text-carbon/55">
              Esto no bloquea el check-out: solo deja constancia para que se resuelva después.
            </span>
          </span>
        </label>

        {saldoPendiente && (
          <Field label="Detalle del saldo pendiente" htmlFor="co-detalle">
            <Input
              id="co-detalle"
              placeholder="Ej.: Consumos de minibar sin facturar"
              value={detalleSaldo}
              disabled={enviando}
              onChange={(e) => setDetalleSaldo(e.target.value)}
            />
          </Field>
        )}

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
          <Button type="submit" cargando={enviando}>
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
