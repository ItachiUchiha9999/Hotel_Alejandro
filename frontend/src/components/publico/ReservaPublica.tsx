"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Button, Input, Select, InfoBox } from '@/components/ui';

type Seleccion = { desde: string; hasta: string; huespedes: number; tipo_id: number; tipo: string; precio_por_noche: number; noches: number; total: number };
type Confirmacion = { codigo: string; email: string; tipo: string; desde: string; hasta: string; huespedes: number; noches: number; total: number; moneda: string; estado: string; vence: string; correo: string };
const STORAGE = 'hotelAlejandro.seleccionECO01';
const BORRADOR = 'hotelAlejandro.solicitudECO02';
const EXITO = 'hotelAlejandro.confirmacionECO02';
const monto = (value: number, currency = 'ARS') => new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
const fecha = (value: string) => new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR');
const campos = { nombre: '', apellido: '', tipoDocumento: 'DNI', documento: '', email: '', telefono: '' };

export function ReservaPublica() {
  const mounted = useSyncExternalStore(suscribir, () => true, () => false);
  return mounted ? <FormularioReservaPublica /> : <p role="status" className="p-8">Recuperando tu elección…</p>;
}
const suscribir = () => () => {};

function recuperarSolicitud() {
  const inicial: { seleccion: Seleccion | null; datos: typeof campos; confirmacion: Confirmacion | null; pendiente: boolean; error: string } = {
    seleccion: null, datos: campos, confirmacion: null, pendiente: false, error: '',
  };
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (raw) {
      const value = JSON.parse(raw) as Seleccion;
      if (!value.desde || !value.hasta || value.hasta <= value.desde || !Number.isInteger(value.tipo_id)
        || !Number.isInteger(value.huespedes) || value.huespedes < 1 || !(value.precio_por_noche > 0)) throw new Error('Selección inválida');
      inicial.seleccion = value;
      const borrador = sessionStorage.getItem(BORRADOR);
      if (borrador) { const saved = JSON.parse(borrador); inicial.datos = saved.datos; inicial.pendiente = true; }
    } else {
      const rawExito = sessionStorage.getItem(EXITO);
      if (rawExito) inicial.confirmacion = JSON.parse(rawExito);
    }
  } catch { inicial.error = 'No pudimos recuperar tu elección. Volvé a buscar disponibilidad.'; }
  return inicial;
}

function FormularioReservaPublica() {
  const [inicial] = useState(recuperarSolicitud);
  const seleccion = inicial.seleccion;
  const [datos, setDatos] = useState(inicial.datos);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(inicial.confirmacion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(inicial.error);
  const [solicitudPendiente, setSolicitudPendiente] = useState(inicial.pendiente);
  const enCurso = useRef(false);

  async function reservar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seleccion || enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    setError('');
    try {
      // Se conserva la solicitud exacta hasta conocer el resultado: también tras recargar.
      const raw = sessionStorage.getItem(BORRADOR);
      const saved = raw ? JSON.parse(raw) : { requestId: crypto.randomUUID(), datos, seleccion };
      sessionStorage.setItem(BORRADOR, JSON.stringify(saved));
      setSolicitudPendiente(true);
      const eleccion = saved.seleccion as Seleccion;
      const resultado = await api.post<Confirmacion>('/publico/reservas', {
        ...saved.datos, requestId: saved.requestId, desde: eleccion.desde, hasta: eleccion.hasta,
        huespedes: eleccion.huespedes, tipoId: eleccion.tipo_id, precioEsperado: eleccion.precio_por_noche,
      });
      setConfirmacion(resultado);
      sessionStorage.setItem(EXITO, JSON.stringify(resultado));
      sessionStorage.removeItem(STORAGE);
      sessionStorage.removeItem(BORRADOR);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar la reserva. Intentá nuevamente.');
      // Solo errores HTTP definitivos permiten editar; sin respuesta, se reintenta la misma solicitud.
      if (err && typeof err === 'object' && 'status' in err && [400, 409].includes(Number(err.status))) {
        sessionStorage.removeItem(BORRADOR); setSolicitudPendiente(false);
      }
    } finally { enCurso.current = false; setGuardando(false); }
  }

  return <main className="min-h-screen bg-[#f7f4ee] text-carbon">
    <header className="bg-[#202d33] text-bone"><div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5">
      <Link href="/web"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={210} height={40} priority /></Link>
      <Link href="/web/consulta" className="text-sm text-bone">Mi reserva</Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[.2em] text-[#a67d4b]">Tu estadía en Salta</p>
      <h1 className="mt-2 font-serif text-4xl">{confirmacion ? 'Reserva registrada' : 'Completá tu reserva'}</h1>
      {error && <div className="mt-6"><InfoBox tipo="error">{error}</InfoBox></div>}
      {confirmacion ? <section className="mt-8 rounded-2xl border border-line bg-white p-6 sm:p-9" aria-live="polite">
        <p className="text-sm text-carbon/65">Guardá tu código para consultar o cancelar la reserva junto con tu documento.</p>
        <p className="my-5 break-all font-serif text-3xl">{confirmacion.codigo}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-carbon/60">Habitación</dt><dd>{confirmacion.tipo}</dd></div>
          <div><dt className="text-xs text-carbon/60">Estadía</dt><dd>{fecha(confirmacion.desde)} al {fecha(confirmacion.hasta)}</dd></div>
          <div><dt className="text-xs text-carbon/60">Huéspedes y noches</dt><dd>{confirmacion.huespedes} huéspedes · {confirmacion.noches} noches</dd></div>
          <div><dt className="text-xs text-carbon/60">Total de alojamiento</dt><dd>{monto(confirmacion.total, confirmacion.moneda)}</dd></div>
        </dl>
        <div className="mt-6"><InfoBox>Tu reserva está pendiente de confirmación por el hotel. El pago se realiza en el hotel. Si no se confirma, vence el {new Date(confirmacion.vence).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} (hora de Argentina).</InfoBox></div>
        <p className="mt-4 text-sm text-carbon/65">{confirmacion.correo === 'ENVIADO' ? `Enviamos los datos a ${confirmacion.email}.` : `El correo con los datos está pendiente de envío a ${confirmacion.email}. Tu reserva ya quedó registrada; conservá el código.`}</p>
        <div className="mt-6 flex flex-wrap gap-5"><Link className="underline" href="/web/consulta">Consultar mi reserva</Link><Link className="underline" href="/web">Volver al hotel</Link></div>
      </section> : seleccion ? <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <form onSubmit={reservar} className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Datos del titular</h2><p className="mt-2 text-sm text-carbon/60">Reservá sin crear una cuenta. Todos los datos son obligatorios.</p>
          <fieldset disabled={guardando || solicitudPendiente} className="mt-6 grid gap-4 sm:grid-cols-2">
            {(['nombre', 'apellido'] as const).map(campo => <label key={campo} className="text-sm">{campo === 'nombre' ? 'Nombre' : 'Apellido'}<Input className="mt-2" required maxLength={100} autoComplete={campo === 'nombre' ? 'given-name' : 'family-name'} value={datos[campo]} onChange={e => setDatos({ ...datos, [campo]: e.target.value })} /></label>)}
            <label className="text-sm">Tipo de documento<Select className="mt-2" value={datos.tipoDocumento} onChange={e => setDatos({ ...datos, tipoDocumento: e.target.value })}>{['DNI', 'PASAPORTE', 'CEDULA', 'LC', 'LE'].map(tipo => <option key={tipo}>{tipo}</option>)}</Select></label>
            <label className="text-sm">Documento<Input className="mt-2" required maxLength={30} value={datos.documento} onChange={e => setDatos({ ...datos, documento: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">Correo electrónico<Input className="mt-2" required type="email" maxLength={150} autoComplete="email" value={datos.email} onChange={e => setDatos({ ...datos, email: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">Teléfono<Input className="mt-2" required type="tel" maxLength={30} autoComplete="tel" value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} /></label>
          </fieldset>
          <p className="mt-6 text-sm text-carbon/60">El pago se realiza en el hotel. La reserva queda pendiente por hasta 24 horas, a la espera de confirmación.</p>
          {solicitudPendiente && !guardando && <p role="status" className="mt-4 text-sm">No recibimos la confirmación. Reintentá con los mismos datos para recuperar el resultado.</p>}
          <Button type="submit" className="mt-6 w-full" cargando={guardando}>{solicitudPendiente ? 'Reintentar mi reserva' : 'Registrar mi reserva'}</Button>
        </form>
        <aside className="h-fit rounded-2xl border border-line bg-white p-6 sm:p-8"><h2 className="font-serif text-2xl">Tu elección</h2><p className="mt-5 font-semibold">{seleccion.tipo}</p><p className="mt-3 text-sm">{fecha(seleccion.desde)} al {fecha(seleccion.hasta)}</p><p className="mt-2 text-sm">{seleccion.huespedes} huéspedes · {seleccion.noches} noches</p><p className="mt-5 text-sm text-carbon/60">{monto(seleccion.precio_por_noche)} por noche</p><p className="mt-2 font-serif text-3xl">{monto(seleccion.total)}</p><p className="mt-3 text-xs text-carbon/60">Validaremos disponibilidad y tarifa al registrar.</p>{!solicitudPendiente && <Link className="mt-6 inline-block text-sm underline" href={`/web/disponibilidad?${new URLSearchParams({ desde: seleccion.desde, hasta: seleccion.hasta, huespedes: String(seleccion.huespedes) })}`}>Cambiar mi elección</Link>}</aside>
      </div> : <div className="mt-8"><p>Elegí primero una habitación y las fechas de tu estadía.</p><Link href="/web" className="mt-4 inline-block underline">Buscar disponibilidad</Link></div>}
    </div>
  </main>;
}
