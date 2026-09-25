"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardFooter, Field, FieldGrid, InfoBox, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface Cliente { guest_id: number; document_type: string; document_number: string; first_name: string; last_name: string; }
interface Habitacion { room_id: number; room_number: string; room_type: { room_type_name: string }; }
interface Catalogos { huespedes: Cliente[]; habitaciones: Habitacion[]; }
interface Reserva { reservation_code: string; }

const fechaLocal = (dias = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dias);
  return date.toISOString().slice(0, 10);
};

export function ReservaForm() {
  const hoy = useMemo(() => fechaLocal(), []);
  const manana = useMemo(() => fechaLocal(1), []);
  const [catalogos, setCatalogos] = useState<Catalogos>({ huespedes: [], habitaciones: [] });
  const [clienteId, setClienteId] = useState("");
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

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>("/reservas/clientes"),
      api.get<Habitacion[]>("/reservas/habitaciones"),
    ])
      .then(([huespedes, habitaciones]) => setCatalogos({ huespedes, habitaciones }))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los catálogos."))
      .finally(() => setCargandoCatalogos(false));
  }, []);

  const registrar = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setExito(null);
    if (checkOut <= checkIn) return setError("La fecha de egreso debe ser posterior a la de ingreso.");
    if (!clienteId || !habitacionId || !employeeId) return setError("Completá cliente, habitación y usuario de recepción.");

    setGuardando(true);
    try {
      const reserva = await api.post<Reserva>("/reservas", {
        clienteId: Number(clienteId),
        habitacionId: Number(habitacionId),
        fechaIngreso: checkIn,
        fechaEgreso: checkOut,
        estadoInicial: estado,
        usuarioRecepcionId: Number(employeeId),
      });
      setExito(`Reserva ${reserva.reservation_code} registrada correctamente.`);
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
        <FieldGrid>
          <Field label="Perfil de cliente" htmlFor="res-cliente" requerido>
            <Select id="res-cliente" value={clienteId} disabled={cargandoCatalogos || guardando} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Elegí un cliente existente</option>
              {catalogos.huespedes.map((cliente) => <option key={cliente.guest_id} value={cliente.guest_id}>{cliente.last_name}, {cliente.first_name} · {cliente.document_type} {cliente.document_number}</option>)}
            </Select>
          </Field>
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
          <Field label="Estado inicial" htmlFor="res-estado" requerido>
            <Select id="res-estado" value={estado} disabled={guardando} onChange={(e) => setEstado(e.target.value)}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="CONFIRMADA">Confirmada</option>
            </Select>
          </Field>
          <Field label="Usuario de recepción" htmlFor="res-empleado" requerido ayuda="Se registra en la auditoría de la reserva.">
            <Input id="res-empleado" type="number" min={1} value={employeeId} disabled={guardando} onChange={(e) => setEmployeeId(e.target.value)} />
          </Field>
        </FieldGrid>
        <CardFooter>
          <Button type="submit" cargando={guardando} disabled={cargandoCatalogos}>Registrar reserva</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
