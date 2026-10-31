"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, LogIn, LogOut, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  TableContainer,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InfoBox } from "@/components/ui/InfoBox";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { api, getReservas, checkInReserva, checkOutReserva, ApiError } from "@/lib/api";
import type { Reserva, EstadoReserva } from "@/lib/types";
import { format, isValid, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";

const HOY = () => format(new Date(), "yyyy-MM-dd");

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** parseISO evita el corrimiento de un día que produce new Date("yyyy-MM-dd") (UTC) en Argentina. */
const fmt = (valor: string, patron: string) => {
  const d = parseISO(valor);
  return isValid(d) ? format(d, patron, { locale: es }) : "—";
};

// Estados de visualización para la página de check-in/check-out (diferentes de EstadoReserva)
type EstadoCheckin = "PENDIENTE" | "CONFIRMADA" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELADA" | "NO_SHOW";

const estadoParaCheckin: Record<EstadoReserva, EstadoCheckin> = {
  PENDIENTE: "PENDIENTE",
  CONFIRMADA: "CONFIRMADA",
  IN_HOUSE: "CHECKED_IN",
  FINALIZADA: "CHECKED_OUT",
  CANCELADA: "CANCELADA",
  NO_SHOW: "NO_SHOW",
};

const etiquetaEstadoCheckin: Record<EstadoCheckin, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CHECKED_IN: "En casa",
  CHECKED_OUT: "Salida",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-show",
};

const tonoEstadoCheckin: Record<EstadoCheckin, "activo" | "inactivo" | "info" | "alerta" | "success" | "danger" | "default"> = {
  PENDIENTE: "alerta",
  CONFIRMADA: "info",
  CHECKED_IN: "success",
  CHECKED_OUT: "default",
  CANCELADA: "inactivo",
  NO_SHOW: "danger",
};

interface ReservaCheckin {
  id: number;
  codigo: string;
  huesped: string;
  habitacion: string;
  tipoHabitacion: string;
  fechaEntrada: string; // yyyy-MM-dd
  fechaSalida: string; // yyyy-MM-dd
  estado: EstadoCheckin;
  acompanantes: number;
  notas?: string;
  // Datos adicionales para el modal de check-in
  adultos: number;
  ninos: number;
  titular: {
    document_type: string;
    document_number: string;
    first_name: string;
    last_name: string;
  };
}

interface AcompananteForm {
  personType: "ADULTO" | "MENOR";
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
}

const TIPOS_DOCUMENTO = ["DNI", "PASAPORTE", "CEDULA", "LC", "LE"] as const;

export default function CheckinPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [fecha, setFecha] = useState(HOY());
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoCheckin>("todos");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal check-in
  const [checkinModalAbierto, setCheckinModalAbierto] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservaCheckin | null>(null);
  const [acompanantesForm, setAcompanantesForm] = useState<AcompananteForm[]>([]);
  const [checkinGuardando, setCheckinGuardando] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Traemos todas las reservas (sin filtro de estado) para poder filtrar por fecha en el cliente
      const data = await getReservas({});
      setReservas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las reservas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const termino = normalizar(busqueda.trim());

  // Llegadas (entrada = fecha) y salidas (salida = fecha) del día seleccionado
  const reservasFiltradas = useMemo(() => {
    return reservas
      .map((r): ReservaCheckin => {
        const estadoCheckin = estadoParaCheckin[r.reservation_status] ?? "CONFIRMADA";
        const adultos = r.adults ?? 1;
        const ninos = r.children ?? 0;
        const acompanantes = adultos + ninos - 1; // -1 por el titular
        // El tipo HabitacionResumen solo tiene room_id y room_number, pero la API puede devolver room_type
        const roomTypeName = (r.room as any).room_type?.room_type_name ?? "—";
        return {
          id: r.reservation_id,
          codigo: r.reservation_code,
          huesped: `${r.guest.last_name}, ${r.guest.first_name}`,
          habitacion: r.room.room_number,
          tipoHabitacion: roomTypeName,
          fechaEntrada: r.check_in_date.slice(0, 10),
          fechaSalida: r.check_out_date.slice(0, 10),
          estado: estadoCheckin,
          acompanantes: Math.max(0, acompanantes),
          notas: r.observations ?? undefined,
          adultos,
          ninos,
          titular: {
            document_type: r.guest.document_type,
            document_number: r.guest.document_number,
            first_name: r.guest.first_name,
            last_name: r.guest.last_name,
          },
        };
      })
      .filter((r) => {
        const coincideFecha = r.fechaEntrada === fecha || r.fechaSalida === fecha;
        const coincideBusqueda =
          termino === "" ||
          normalizar(r.codigo).includes(termino) ||
          normalizar(r.huesped).includes(termino) ||
          r.habitacion.includes(busqueda.trim());
        const coincideEstado = filtroEstado === "todos" || r.estado === filtroEstado;
        return coincideFecha && coincideBusqueda && coincideEstado;
      });
  }, [reservas, fecha, busqueda, filtroEstado]);

  // Abrir modal de check-in y preparar formulario de acompañantes
  const abrirModalCheckin = (reserva: ReservaCheckin) => {
    setReservaSeleccionada(reserva);
    setCheckinError(null);

    // Preparar formulario de acompañantes basado en la reserva
    // El titular ya está incluido, necesitamos (adultos + niños - 1) acompañantes
    const totalHuespedes = reserva.adultos + reserva.ninos;
    const cantidadAcompanantes = totalHuespedes - 1; // -1 por el titular

    const formsIniciales: AcompananteForm[] = [];
    for (let i = 0; i < cantidadAcompanantes; i++) {
      // Los primeros (adultos - 1) son adultos, el resto son menores
      const esAdulto = i < reserva.adultos - 1;
      formsIniciales.push({
        personType: esAdulto ? "ADULTO" : "MENOR",
        documentType: "DNI",
        documentNumber: "",
        firstName: "",
        lastName: "",
      });
    }
    setAcompanantesForm(formsIniciales);
    setCheckinModalAbierto(true);
  };

  // Cerrar modal de check-in
  const cerrarModalCheckin = () => {
    setCheckinModalAbierto(false);
    setReservaSeleccionada(null);
    setAcompanantesForm([]);
    setCheckinError(null);
  };

  // Manejar cambios en los campos de acompañantes
  const actualizarAcompanante = (index: number, field: keyof AcompananteForm, value: string) => {
    setAcompanantesForm((prev) => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], [field]: value };
      return nuevo;
    });
  };

  // Validar formulario de check-in
  const validarFormularioCheckin = (): boolean => {
    if (!reservaSeleccionada) return false;

    const totalEsperado = reservaSeleccionada.adultos + reservaSeleccionada.ninos;
    if (acompanantesForm.length !== totalEsperado - 1) {
      setCheckinError(`Se esperan ${totalEsperado - 1} acompañantes (total ${totalEsperado} huéspedes incluido el titular).`);
      return false;
    }

    // Validar cada acompañante
    const documentosVistos = new Set<string>();
    // Agregar documento del titular
    documentosVistos.add(`${reservaSeleccionada.titular.document_type}:${reservaSeleccionada.titular.document_number.toLowerCase()}`);

    for (let i = 0; i < acompanantesForm.length; i++) {
      const a = acompanantesForm[i];
      if (!a.documentType || !a.documentNumber || !a.firstName || !a.lastName) {
        setCheckinError(`El acompañante ${i + 1} debe tener nombre, apellido y documento completos.`);
        return false;
      }
      if (!TIPOS_DOCUMENTO.includes(a.documentType as typeof TIPOS_DOCUMENTO[number])) {
        setCheckinError(`El acompañante ${i + 1} tiene un tipo de documento inválido.`);
        return false;
      }
      const clave = `${a.documentType}:${a.documentNumber.toLowerCase()}`;
      if (documentosVistos.has(clave)) {
        setCheckinError(`El documento ${a.documentNumber} ya está registrado (titular o otro acompañante).`);
        return false;
      }
      documentosVistos.add(clave);
    }

    // Validar que las cantidades de adultos/menores coincidan
    const adultosForm = acompanantesForm.filter((a) => a.personType === "ADULTO").length;
    const menoresForm = acompanantesForm.filter((a) => a.personType === "MENOR").length;
    const adultosEsperados = reservaSeleccionada.adultos - 1; // -1 por titular que ya es adulto
    const menoresEsperados = reservaSeleccionada.ninos;

    if (adultosForm !== adultosEsperados || menoresForm !== menoresEsperados) {
      setCheckinError(`Las categorías no coinciden: se esperan ${adultosEsperados} adultos y ${menoresEsperados} menores como acompañantes.`);
      return false;
    }

    setCheckinError(null);
    return true;
  };

  // Confirmar check-in con datos de acompañantes
  const confirmarCheckin = async () => {
    if (!validarFormularioCheckin() || !reservaSeleccionada) return;

    const totalEsperado = reservaSeleccionada.adultos + reservaSeleccionada.ninos;
    setCheckinGuardando(true);
    try {
      // Preparar guests para el backend (solo acompañantes, el titular se agrega automáticamente)
      const guests = acompanantesForm.map((a) => ({
        personType: a.personType,
        documentType: a.documentType,
        documentNumber: a.documentNumber,
        firstName: a.firstName,
        lastName: a.lastName,
      }));

      const actualizada = await checkInReserva(reservaSeleccionada.id, {
        actualAdults: reservaSeleccionada.adultos,
        actualChildren: reservaSeleccionada.ninos,
        guests,
        observations: undefined,
        employeeId: 1, // TODO: usar employeeId real del login
      });

      setMensaje(`Check-in registrado. Habitación ${actualizada.room.room_number} ocupada con ${totalEsperado} huéspedes.`);
      await cargar();
      cerrarModalCheckin();
    } catch (err) {
      setCheckinError(err instanceof ApiError ? err.message : "No se pudo registrar el check-in.");
    } finally {
      setCheckinGuardando(false);
    }
    setTimeout(() => setMensaje(null), 4000);
  };

  const handleCheckout = async (r: ReservaCheckin) => {
    try {
      const actualizada = await checkOutReserva(r.id, {
        settleServiceCharges: false,
        settleAccommodationBalance: false,
        employeeId: 1, // TODO: usar employeeId real del login
      });
      const msg = actualizada.check_out_pending_charges
        ? "Check-out registrado. Atención: la estadía quedó con saldo pendiente de facturar/cobrar."
        : "Check-out registrado correctamente.";
      setMensaje(msg);
      await cargar(); // recargar para reflejar el cambio
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el check-out.");
    }
    setTimeout(() => setMensaje(null), 4000);
  };

  const estadosConfig: Record<EstadoCheckin, { label: string; variant: "info" | "success" | "default" | "danger" }> = {
    PENDIENTE: { label: "Pendiente", variant: "info" },
    CONFIRMADA: { label: "Confirmada", variant: "info" },
    CHECKED_IN: { label: "En casa", variant: "success" },
    CHECKED_OUT: { label: "Salida", variant: "default" },
    CANCELADA: { label: "Cancelada", variant: "default" },
    NO_SHOW: { label: "No show", variant: "danger" },
  };

  return (
    <>
      <PageHeader
        titulo="Check-in / Check-out"
        descripcion="Gestioná las llegadas y salidas del día"
        acciones={
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-neutral-500">
              {fmt(fecha, "EEEE d 'de' MMMM")}
            </span>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className="w-40"
              aria-label="Fecha"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Buscar por código, huésped o habitación"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="w-full sm:w-96"
          aria-label="Buscar reservas"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as "todos" | EstadoCheckin)}
          aria-label="Filtrar por estado"
          className="px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
        >
          <option value="todos">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="CONFIRMADA">Confirmadas</option>
          <option value="CHECKED_IN">En casa</option>
          <option value="CHECKED_OUT">Salidas</option>
          <option value="NO_SHOW">No show</option>
          <option value="CANCELADA">Canceladas</option>
        </select>
        <span className="text-sm text-neutral-500 sm:ml-auto">
          {reservasFiltradas.length} {reservasFiltradas.length === 1 ? "reserva" : "reservas"}
        </span>
      </div>

      {error && (
        <div className="mb-4">
          <InfoBox tipo="error">
            {error}{" "}
            <button type="button" onClick={cargar} className="underline underline-offset-2">
              Reintentar
            </button>
          </InfoBox>
        </div>
      )}

      {mensaje && (
        <p role="status" className="mb-4 rounded border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-800">
          {mensaje}
        </p>
      )}

      <Card padding="none" className="overflow-hidden">
        <TableContainer>
          <TableHeader>
            <TableRow>
              <TableHead>Reserva</TableHead>
              <TableHead>Huésped</TableHead>
              <TableHead>Habitación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead align="center">Acomp.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead align="right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell className="py-10 text-center" colSpan={9}>
                  <SkeletonTable rows={5} columns={9} />
                </TableCell>
              </TableRow>
            ) : reservasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-neutral-500 text-center" colSpan={9}>
                  No hay llegadas ni salidas para la fecha seleccionada
                </TableCell>
              </TableRow>
            ) : (
              reservasFiltradas.map((reserva) => (
                <TableRow key={reserva.id} hover>
                  <TableCell className="py-3 px-4 font-medium">{reserva.codigo}</TableCell>
                  <TableCell className="py-3 px-4">
                    <p>{reserva.huesped}</p>
                    {reserva.notas && <p className="mt-0.5 text-xs text-neutral-500">{reserva.notas}</p>}
                  </TableCell>
                  <TableCell className="py-3 px-4 font-medium">{reserva.habitacion}</TableCell>
                  <TableCell className="py-3 px-4">{reserva.tipoHabitacion}</TableCell>
                  <TableCell className={`py-3 px-4 ${reserva.fechaEntrada === fecha ? "font-medium text-neutral-900" : "text-neutral-500"}`}>
                    {fmt(reserva.fechaEntrada, "dd/MM")}
                  </TableCell>
                  <TableCell className={`py-3 px-4 ${reserva.fechaSalida === fecha ? "font-medium text-neutral-900" : "text-neutral-500"}`}>
                    {fmt(reserva.fechaSalida, "dd/MM")}
                  </TableCell>
                  <TableCell align="center" className="py-3 px-4">
                    {reserva.acompanantes}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge variant={estadosConfig[reserva.estado].variant}>
                      {estadosConfig[reserva.estado].label}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {reserva.estado === "CONFIRMADA" && (
                        <Button size="sm" onClick={() => abrirModalCheckin(reserva)} leftIcon={<LogIn className="w-3.5 h-3.5" />}>
                          Check-in
                        </Button>
                      )}
                      {reserva.estado === "CHECKED_IN" && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckout(reserva)} leftIcon={<LogOut className="w-3.5 h-3.5" />}>
                          Check-out
                        </Button>
                      )}
                      {(reserva.estado === "NO_SHOW" ||
                        reserva.estado === "CHECKED_OUT" ||
                        reserva.estado === "CANCELADA") && <span className="text-neutral-300">—</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </TableContainer>
      </Card>

      {/* Modal Check-in */}
      {checkinModalAbierto && reservaSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModalCheckin();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-carbon/10 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-carbon/10 bg-white px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon/45">
                  RES-09 · CHECK-IN
                </p>
                <h2 className="mt-1 text-lg font-semibold">Registrar check-in</h2>
                <p className="mt-1 text-xs text-carbon/55">
                  Reserva <span className="font-mono">{reservaSeleccionada.codigo}</span> — Hab. <span className="font-mono">{reservaSeleccionada.habitacion}</span> ({reservaSeleccionada.tipoHabitacion})
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModalCheckin}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-carbon/40 hover:bg-carbon/5"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* TITULAR */}
              <div className="mb-6 p-4 rounded-lg border border-carbon/10 bg-carbon/[0.025]">
                <h3 className="text-sm font-semibold text-carbon/70 mb-3">Titular de la reserva</h3>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Tipo doc.</label>
                    <Input value={reservaSeleccionada.titular.document_type} readOnly className="bg-carbon/[0.025]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">N° documento</label>
                    <Input value={reservaSeleccionada.titular.document_number} readOnly className="bg-carbon/[0.025]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Nombre</label>
                    <Input value={reservaSeleccionada.titular.first_name} readOnly className="bg-carbon/[0.025]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Apellido</label>
                    <Input value={reservaSeleccionada.titular.last_name} readOnly className="bg-carbon/[0.025]" />
                  </div>
                </div>
              </div>

              {/* ACOMPAÑANTES */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Acompañantes ({acompanantesForm.length})</h3>
                  <span className="text-xs text-carbon/50">
                    Total huéspedes: {reservaSeleccionada.adultos + reservaSeleccionada.ninos} ({reservaSeleccionada.adultos} adultos, {reservaSeleccionada.ninos} menores)
                  </span>
                </div>

                {checkinError && (
                  <div className="mb-4 p-3 rounded border border-danger-200 bg-danger-50 text-sm text-danger-800">
                    {checkinError}
                  </div>
                )}

                {acompanantesForm.length === 0 ? (
                  <div className="py-6 text-center text-sm text-carbon/50">
                    Esta reserva no tiene acompañantes (solo el titular).
                  </div>
                ) : (
                  <div className="space-y-4">
                    {acompanantesForm.map((a, index) => (
                      <div key={index} className="p-4 rounded-lg border border-carbon/10 bg-white">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-gold-100 text-gold-700 text-xs font-medium">
                            {index + 1}
                          </span>
                          <h4 className="text-sm font-medium mt-1">Acompañante {index + 1}</h4>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-5">
                          <div>
                            <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Categoría</label>
                            <select
                              value={a.personType}
                              onChange={(e) => actualizarAcompanante(index, "personType", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-carbon/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                            >
                              <option value="ADULTO">Adulto</option>
                              <option value="MENOR">Menor</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Tipo doc.</label>
                            <select
                              value={a.documentType}
                              onChange={(e) => actualizarAcompanante(index, "documentType", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-carbon/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-400"
                            >
                              {TIPOS_DOCUMENTO.map((tipo) => (
                                <option key={tipo} value={tipo}>{tipo}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">N° documento</label>
                            <Input
                              value={a.documentNumber}
                              onChange={(e) => actualizarAcompanante(index, "documentNumber", e.target.value.toUpperCase())}
                              placeholder="Ej: 34567890"
                              className="text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Nombre</label>
                            <Input
                              value={a.firstName}
                              onChange={(e) => actualizarAcompanante(index, "firstName", e.target.value)}
                              placeholder="Nombre"
                              className="text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium uppercase text-carbon/45 mb-1">Apellido</label>
                            <Input
                              value={a.lastName}
                              onChange={(e) => actualizarAcompanante(index, "lastName", e.target.value)}
                              placeholder="Apellido"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ACCIONES */}
                <div className="mt-6 flex justify-end gap-3 border-t border-carbon/10 pt-5">
                  <Button variante="secundario" onClick={cerrarModalCheckin}>
                    Cancelar
                  </Button>
                  <Button onClick={confirmarCheckin} disabled={checkinGuardando}>
                    {checkinGuardando ? "Registrando..." : "Confirmar check-in"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}