"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError, getHistorialTarifas } from "@/lib/api";

interface Cliente { guest_id: number; document_type: string; document_number: string; first_name: string; last_name: string; }
interface Habitacion { room_id: number; room_number: string; room_type: { room_type_id: number; room_type_name: string }; }
interface Catalogos { huespedes: Cliente[]; habitaciones: Habitacion[]; }
interface Reserva { reservation_code: string; guest: Cliente; }
const clienteVacio = { first_name: '', last_name: '', document_type: 'DNI', document_number: '', email: '', phone: '' };

const fechaLocal = (dias = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dias);
  const año = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const día = String(date.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
};

// ---------------------------------------------------------------------------
// Precio estimado: tarifa vigente del tipo de habitación a la fecha de ingreso
// ---------------------------------------------------------------------------
interface Tarifa {
  rate_id: number;
  base_price: number | string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  active: boolean;
}

// Compara fechas como texto AAAA-MM-DD: las del backend llegan con hora (ISO),
// así que nos quedamos con los primeros 10 caracteres.
const soloDia = (valor: string | Date) => String(valor).slice(0, 10);

/**
 * Devuelve la tarifa vigente de un tipo para una fecha de ingreso: activa,
 * con valid_from <= fecha y sin valid_to (o valid_to > fecha). Si hay varias,
 * gana la de valid_from más reciente. Sin ninguna, devuelve null.
 */
function tarifaVigente(tarifas: Tarifa[], fecha: string): Tarifa | null {
  return [...tarifas]
    .filter((tarifa) => tarifa.active
      && soloDia(tarifa.valid_from) <= fecha
      && (!tarifa.valid_to || soloDia(tarifa.valid_to) > fecha))
    .sort((a, b) => soloDia(b.valid_from).localeCompare(soloDia(a.valid_from)))
    .at(0) ?? null;
}

export function ReservaForm() {
  const hoy = useMemo(() => fechaLocal(), []);
  const manana = useMemo(() => fechaLocal(1), []);
  const [catalogos, setCatalogos] = useState<Catalogos>({ huespedes: [], habitaciones: [] });
  const [clienteId, setClienteId] = useState("");
  const [modoCliente, setModoCliente] = useState<'existente' | 'nuevo'>('existente');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({ ...clienteVacio });
  const clientesVisibles = catalogos.huespedes.filter(c => c.guest_id === Number(clienteId) ||
    `${c.first_name} ${c.last_name} ${c.document_number}`.toLocaleLowerCase().includes(busquedaCliente.trim().toLocaleLowerCase()));
  const duplicado = catalogos.huespedes.find(c => c.document_type.toUpperCase() === nuevoCliente.document_type &&
    c.document_number.trim().toUpperCase() === nuevoCliente.document_number.trim().toUpperCase());
  const [habitacionId, setHabitacionId] = useState("");
  const [checkIn, setCheckIn] = useState(hoy);
  const [checkOut, setCheckOut] = useState(manana);
  const [estado, setEstado] = useState("PENDIENTE");
  const [employeeId, setEmployeeId] = useState(() => {
    if (typeof window === "undefined") return "1";
    return window.localStorage.getItem("employeeId") ?? "1";
  });
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargandoTarifa, setCargandoTarifa] = useState(false);
  // Último tipo de habitación pedido: si el usuario cambia de habitación
  // mientras viaja una respuesta, se descarta la que llega tarde.
  const ultimoTipoSolicitado = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>("/reservas/clientes"),
      api.get<Habitacion[]>("/reservas/habitaciones"),
    ])
      .then(([huespedes, habitaciones]) => setCatalogos({ huespedes, habitaciones }))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los catálogos."))
      .finally(() => setCargandoCatalogos(false));
  }, []);

  // Habitación física elegida: sirve para conocer su tipo y buscar tarifas.
  const habitacionSeleccionada = useMemo(
    () => catalogos.habitaciones.find((habitacion) => habitacion.room_id === Number(habitacionId)) ?? null,
    [catalogos, habitacionId],
  );

  // Trae el historial de tarifas del tipo de la habitación elegida. Solo
  // depende de la habitación: el historial no cambia con la fecha, la vigencia
  // se calcula del lado del cliente con tarifaVigente().
  useEffect(() => {
    const tipoId = habitacionSeleccionada?.room_type.room_type_id ?? null;
    ultimoTipoSolicitado.current = tipoId;
    if (!tipoId) {
      setTarifas([]);
      return;
    }
    setCargandoTarifa(true);
    getHistorialTarifas(tipoId)
      .then((lista) => {
        if (ultimoTipoSolicitado.current === tipoId) setTarifas(lista as Tarifa[]);
      })
      .catch(() => {
        if (ultimoTipoSolicitado.current === tipoId) setTarifas([]);
      })
      .finally(() => {
        if (ultimoTipoSolicitado.current === tipoId) setCargandoTarifa(false);
      });
  }, [habitacionSeleccionada]);

  // Precio estimado: tarifa vigente a la fecha de ingreso por las noches.
  // Es informativo: el monto definitivo lo calcula el backend al registrar.
  const tarifa = useMemo(() => tarifaVigente(tarifas, checkIn), [tarifas, checkIn]);
  const noches = useMemo(() => {
    const dias = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    return Number.isFinite(dias) && dias > 0 ? dias : 0;
  }, [checkIn, checkOut]);
  const precioNoche = tarifa ? Number(tarifa.base_price) : 0;
  const estimado = tarifa && noches > 0 ? precioNoche * noches : null;
  const formatoMoneda = (valor: number, moneda = "ARS") =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda }).format(valor);

  const registrar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setExito(null);
    if (checkOut <= checkIn) return setError("La fecha de egreso debe ser posterior a la de ingreso.");
    if ((modoCliente === 'existente' && !clienteId) || !habitacionId || !employeeId) return setError("Completá cliente, habitación y usuario de recepción.");
    if (modoCliente === 'nuevo') {
      if (!nuevoCliente.first_name.trim() || !nuevoCliente.last_name.trim() || !nuevoCliente.document_number.trim()) return setError('Completá nombre, apellido y documento del nuevo cliente.');
      if (duplicado) return setError('El documento ya está registrado. Usá el cliente existente.');
      if (nuevoCliente.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoCliente.email.trim())) return setError('Ingresá un correo electrónico válido.');
    }

    setGuardando(true);
    try {
      const reserva = await api.post<Reserva>("/reservas", {
        ...(modoCliente === 'nuevo' ? { nuevoCliente } : { clienteId: Number(clienteId) }),
        habitacionId: Number(habitacionId),
        fechaIngreso: checkIn,
        fechaEgreso: checkOut,
        estadoInicial: estado,
        usuarioRecepcionId: Number(employeeId),
      });
      setExito(`Reserva ${reserva.reservation_code} registrada correctamente.`);
      setCatalogos(actual => ({ ...actual, huespedes: actual.huespedes.some(c => c.guest_id === reserva.guest.guest_id)
        ? actual.huespedes : [...actual.huespedes, reserva.guest] }));
      setNuevoCliente({ ...clienteVacio });
      setModoCliente('existente');
      setBusquedaCliente('');
      setClienteId("");
      setHabitacionId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la reserva.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <form onSubmit={registrar} noValidate className="space-y-5">
        {error && <InfoBox tipo="error">{error}</InfoBox>}
        {exito && <InfoBox tipo="exito">{exito}</InfoBox>}
        <fieldset disabled={guardando} className="space-y-3">
          <legend className="mb-2 font-semibold">Cliente de la reserva</legend>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2"><input type="radio" name="modo-cliente" checked={modoCliente === 'existente'} onChange={() => { setModoCliente('existente'); setError(null); }} />Cliente existente</label>
            <label className="flex items-center gap-2"><input type="radio" name="modo-cliente" checked={modoCliente === 'nuevo'} onChange={() => { setModoCliente('nuevo'); setError(null); }} />Cliente nuevo</label>
          </div>
          {modoCliente === 'existente' ? <FieldGrid>
            <Field label="Buscar cliente" htmlFor="res-buscar-cliente">
              <Input id="res-buscar-cliente" type="search" placeholder="Nombre, apellido o documento" value={busquedaCliente} onChange={e => setBusquedaCliente(e.target.value)} />
            </Field>
            <Field label="Perfil de cliente" htmlFor="res-cliente" requerido>
              <Select id="res-cliente" value={clienteId} disabled={cargandoCatalogos || guardando} onChange={e => setClienteId(e.target.value)}>
                <option value="">Elegí un cliente existente</option>
                {clientesVisibles.map(c => <option key={c.guest_id} value={c.guest_id}>{c.last_name}, {c.first_name} · {c.document_type} {c.document_number}</option>)}
              </Select>
              {!cargandoCatalogos && !clientesVisibles.length && <p className="mt-2 text-sm">No hay coincidencias. Podés elegir Cliente nuevo.</p>}
            </Field>
          </FieldGrid> : <>
            <FieldGrid>
              <Field label="Nombre" htmlFor="res-nombre" requerido><Input id="res-nombre" maxLength={100} autoComplete="given-name" value={nuevoCliente.first_name} onChange={e => setNuevoCliente({ ...nuevoCliente, first_name: e.target.value })} /></Field>
              <Field label="Apellido" htmlFor="res-apellido" requerido><Input id="res-apellido" maxLength={100} autoComplete="family-name" value={nuevoCliente.last_name} onChange={e => setNuevoCliente({ ...nuevoCliente, last_name: e.target.value })} /></Field>
              <Field label="Tipo de documento" htmlFor="res-tipo-doc" requerido><Select id="res-tipo-doc" value={nuevoCliente.document_type} onChange={e => setNuevoCliente({ ...nuevoCliente, document_type: e.target.value })}>
                {['DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE'].map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </Select></Field>
              <Field label="Número de documento" htmlFor="res-documento" requerido><Input id="res-documento" maxLength={30} value={nuevoCliente.document_number} onChange={e => setNuevoCliente({ ...nuevoCliente, document_number: e.target.value })} /></Field>
              <Field label="Correo (opcional)" htmlFor="res-correo"><Input id="res-correo" type="email" maxLength={150} autoComplete="email" value={nuevoCliente.email} onChange={e => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} /></Field>
              <Field label="Teléfono (opcional)" htmlFor="res-telefono"><Input id="res-telefono" type="tel" maxLength={30} autoComplete="tel" value={nuevoCliente.phone} onChange={e => setNuevoCliente({ ...nuevoCliente, phone: e.target.value })} /></Field>
            </FieldGrid>
            {duplicado && <InfoBox tipo="error">Ya existe {duplicado.first_name} {duplicado.last_name} con ese documento.
              <button type="button" className="ml-2 underline" onClick={() => { setClienteId(String(duplicado.guest_id)); setModoCliente('existente'); setBusquedaCliente(''); setError(null); }}>Usar este cliente</button>
            </InfoBox>}
            <p className="text-sm text-carbon/70">El cliente se guardará junto con la reserva al confirmar.</p>
          </>}
        </fieldset>
        <FieldGrid>
          <Field label="Habitación" htmlFor="res-habitacion" requerido>
            <Select id="res-habitacion" value={habitacionId} disabled={cargandoCatalogos || guardando} onChange={(e) => setHabitacionId(e.target.value)}>
              <option value="">Elegí una habitación</option>
              {catalogos.habitaciones.map((habitacion) => <option key={habitacion.room_id} value={habitacion.room_id}>{habitacion.room_number} · {habitacion.room_type.room_type_name}</option>)}
            </Select>
          </Field>
          <Field label="Fecha de ingreso" htmlFor="res-ingreso" requerido>
            <Input id="res-ingreso" type="date" min={hoy} value={checkIn} disabled={guardando} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Fecha de egreso" htmlFor="res-egreso" requerido>
            <Input id="res-egreso" type="date" min={checkIn || hoy} value={checkOut} disabled={guardando} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
          <Field label="Estado inicial" htmlFor="res-estado" requerido ayuda="Pendiente queda a la espera de aceptación o seña y vence en 24 horas.">
            <Select id="res-estado" value={estado} disabled={guardando} onChange={(e) => setEstado(e.target.value)}>
              <option value="PENDIENTE">Pendiente (esperando aceptación o seña; vence en 24 h)</option>
              <option value="CONFIRMADA">Confirmada</option>
            </Select>
          </Field>
          <Field label="Usuario de recepción" htmlFor="res-empleado" requerido ayuda="Se registra en la auditoría de la reserva.">
            <Input id="res-empleado" type="number" min={1} value={employeeId} disabled={guardando} onChange={(e) => setEmployeeId(e.target.value)} />
          </Field>
        </FieldGrid>
        {habitacionId && (
          <InfoBox tipo="regla" titulo="Precio estimado">
            {cargandoTarifa
              ? "Consultando la tarifa vigente…"
              : !tarifa
                ? "La habitación no tiene tarifa vigente para la fecha de ingreso elegida."
                : noches === 0
                  ? "Elegí una fecha de egreso posterior a la de ingreso para ver el estimado."
                  : `Tarifa vigente: ${formatoMoneda(precioNoche, tarifa.currency || "ARS")} por noche · ${noches} ${noches === 1 ? "noche" : "noches"} · Estimado del alojamiento: ${formatoMoneda(estimado ?? 0, tarifa.currency || "ARS")}`}
          </InfoBox>
        )}
        <CardFooter>
          <Button type="submit" cargando={guardando} disabled={cargandoCatalogos}>Registrar reserva</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
