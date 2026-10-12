"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, CircleCheck, Clock3, FileSearch, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Button, InfoBox, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Detalle = {
  codigo: string; huesped: string; documento: string; fecha_ingreso: string; fecha_salida: string;
  hora_llegada: string | null; huespedes: number; habitacion: string; tipo_habitacion: string; total: number; estado: string;
  cancelable: boolean; cancelacion: null | { condiciones: string; horas_cancelacion_sin_cargo: number; porcentaje_penalidad: number; penalidad: number };
};
const moneda = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fecha = (v: string) => new Date(v.slice(0, 10) + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export function ConsultaReservaPublica() {
  const [codigo, setCodigo] = useState(""); const [documento, setDocumento] = useState("");
  const [reserva, setReserva] = useState<Detalle | null>(null); const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false); const [cargando, setCargando] = useState(false); const [cancelando, setCancelando] = useState(false);
  async function consultar(e: FormEvent) {
    e.preventDefault(); setError(""); setReserva(null); setConfirmar(false);
    if (!codigo.trim() || !documento.trim()) return setError("Ingresá el código de reserva y el documento del huésped.");
    setCargando(true); try { setReserva(await api.post<Detalle>("/publico/reservas/consultar", { codigo, documento })); }
    catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo consultar la reserva."); } finally { setCargando(false); }
  }
  async function cancelar() {
    setCancelando(true); setError(""); try {
      await api.post("/publico/reservas/" + encodeURIComponent(codigo.trim()) + "/cancelar", { documento });
      setReserva(current => current ? { ...current, estado: "CANCELADA", cancelable: false } : current); setConfirmar(false);
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo cancelar la reserva. Volvé a consultar su estado."); }
    finally { setCancelando(false); }
  }
  return <main className="min-h-screen bg-[#f7f4ee] text-carbon">
    <header className="border-b border-white/10 bg-[#202d33] text-bone"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-10">
      <Link href="/web" aria-label="Hotel Alejandro I, inicio"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={210} height={40}/></Link>
      <Link href="/web" className="rounded-full border border-gold/60 px-4 py-2.5 text-xs text-bone transition hover:bg-gold hover:text-carbon sm:text-sm">Volver al hotel</Link>
    </div></header>
    <section className="relative overflow-hidden bg-[#26343a] text-bone"><div className="absolute -right-12 -top-32 h-96 w-96 rounded-full border border-gold/15"/><div className="absolute -right-4 -top-24 h-80 w-80 rounded-full border border-gold/10"/><div className="relative mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
      <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#dfbd84]">Atención a huéspedes</p><h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">Tu reserva, siempre a mano.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Consultá los detalles de tu estadía o revisá las condiciones para cancelarla.</p>
    </div></section>
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[.72fr_1.28fr] md:px-10 md:py-14">
      <aside className="space-y-5"><div className="rounded-2xl border border-[#e8e0d4] bg-white p-6 shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#f3eadb] text-[#a67d4b]"><FileSearch size={20}/></div><h2 className="mt-5 font-serif text-xl">Encontrá tu estadía</h2><p className="mt-2 text-sm leading-6 text-carbon/60">Ingresá el código de reserva y el documento utilizado al registrarla. Solo vos podrás ver sus datos.</p></div>
        <div className="flex gap-3 rounded-2xl border border-[#e8e0d4] bg-[#f0eee7] p-5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#7b8d72]"/><p className="text-xs leading-5 text-carbon/60">La consulta valida ambos datos antes de mostrar la información de la reserva.</p></div>
      </aside>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#e8e0d4] bg-white p-5 shadow-[0_14px_40px_#17252a0a] sm:p-8">
          <div className="mb-6"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#a67d4b]">Consulta segura</p><h2 className="mt-1 font-serif text-2xl">Ingresá tus datos</h2></div>
          <form onSubmit={consultar} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="eco-codigo" className="block"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-carbon/55">Código de reserva</span><Input id="eco-codigo" autoComplete="off" maxLength={20} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej. HA-000123" required className="h-12 bg-[#fbfaf7]"/></label>
            <label htmlFor="eco-documento" className="block"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-carbon/55">Documento del huésped</span><Input id="eco-documento" autoComplete="off" maxLength={30} value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Número de documento" required className="h-12 bg-[#fbfaf7]"/></label>
          </div>{error && <InfoBox tipo="error">{error}</InfoBox>}<div className="flex justify-end"><Button type="submit" cargando={cargando} className="rounded-md px-6">Consultar reserva</Button></div></form>
        </section>
        {reserva && <section className="overflow-hidden rounded-2xl border border-[#e8e0d4] bg-white shadow-[0_14px_40px_#17252a0a]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eee8de] bg-[#fcfbf8] px-5 py-5 sm:px-8"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#a67d4b]">Confirmación</p><h2 className="mt-1 font-serif text-2xl">Reserva {reserva.codigo}</h2><p className="mt-1 text-sm text-carbon/55">{reserva.tipo_habitacion} · Habitación {reserva.habitacion}</p></div><span className={"rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] " + (reserva.estado === "CANCELADA" ? "bg-[#f7e9e5] text-[#a75548]" : reserva.cancelable ? "bg-[#edf2ec] text-[#56725c]" : "bg-[#f1eee7] text-[#817258]")}>{reserva.estado.replaceAll("_", " ")}</span></div>
          <div className="grid gap-px bg-[#eee8de] sm:grid-cols-2"><div className="bg-white p-5 sm:p-7"><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Huésped</p><p className="mt-1 font-medium">{reserva.huesped}</p><p className="text-xs text-carbon/55">{reserva.documento}</p></div><div className="bg-white p-5 sm:p-7"><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Viajeros</p><p className="mt-1 flex items-center gap-2 font-medium"><Users size={15} className="text-[#a67d4b]"/>{reserva.huespedes} huéspedes</p></div><div className="bg-white p-5 sm:p-7"><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Ingreso</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays size={15} className="text-[#a67d4b]"/>{fecha(reserva.fecha_ingreso)}</p></div>{reserva.hora_llegada && <div className="bg-white p-5 sm:p-7"><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Hora de llegada</p><p className="mt-1 flex items-center gap-2 font-medium"><Clock3 size={15} className="text-[#a67d4b]"/>{reserva.hora_llegada}</p></div>}<div className="bg-white p-5 sm:p-7"><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Salida</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays size={15} className="text-[#a67d4b]"/>{fecha(reserva.fecha_salida)}</p></div></div>
          <div className="flex items-end justify-between gap-3 border-t border-[#eee8de] px-5 py-5 sm:px-8"><div><p className="text-[10px] uppercase tracking-[.14em] text-carbon/45">Total de estadía</p><p className="mt-1 font-serif text-2xl">{moneda(reserva.total)}</p></div><span className="text-right text-xs text-carbon/50">{reserva.tipo_habitacion}<br/>Habitación {reserva.habitacion}</span></div>
          {reserva.estado === "CANCELADA" && <div className="px-5 pb-6 sm:px-8"><InfoBox tipo="regla">Esta reserva ya fue cancelada.</InfoBox></div>}
          {reserva.cancelable && reserva.cancelacion && <div className="border-t border-[#eee8de] bg-[#fbfaf7] px-5 py-6 sm:px-8"><div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#a67d4b]"/><div><h3 className="font-serif text-lg">Condiciones de cancelación</h3><p className="mt-1 text-sm leading-6 text-carbon/60">{reserva.cancelacion.condiciones}</p></div></div>
            <div className="mt-4 rounded-xl border border-[#e8e0d4] bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-carbon/50">Penalidad estimada</p><p className="mt-1 font-serif text-2xl">{moneda(reserva.cancelacion.penalidad)} <span className="font-sans text-xs text-carbon/45">({reserva.cancelacion.porcentaje_penalidad}%)</span></p><p className="mt-1 text-[11px] text-carbon/45">Se informa antes de confirmar la cancelación.</p></div>
            {confirmar ? <div className="mt-5 rounded-xl border border-[#ead5ce] bg-[#fbf3f0] p-4"><div className="flex gap-2 text-sm font-medium text-[#8f483e]"><TriangleAlert size={17}/> ¿Confirmás cancelar esta reserva?</div><div className="mt-4 flex flex-wrap justify-end gap-3"><Button variante="secundario" type="button" onClick={() => setConfirmar(false)}>Volver</Button><Button variante="peligro" type="button" cargando={cancelando} onClick={cancelar}>Sí, cancelar reserva</Button></div></div> : <div className="mt-5 flex justify-end"><Button variante="peligro" type="button" onClick={() => setConfirmar(true)}><TriangleAlert size={16}/> Solicitar cancelación</Button></div>}
          </div>}
          {!reserva.cancelable && reserva.estado !== "CANCELADA" && <div className="px-5 pb-6 sm:px-8"><InfoBox tipo="regla">Esta reserva no puede cancelarse desde la web por su estado actual.</InfoBox></div>}
          {!reserva.cancelable && reserva.estado === "CANCELADA" && <div className="sr-only"><CircleCheck/></div>}
        </section>}
      </div>
    </div>
    <footer className="mt-4 bg-[#202d33] text-bone"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-7 md:px-10"><p className="font-serif">Hotel Alejandro I <span className="font-sans text-xs text-bone/50">· Salta, Argentina</span></p><Link href="/web" className="inline-flex items-center gap-2 text-xs text-bone/65 hover:text-gold-light"><ArrowLeft size={14}/> Volver al sitio</Link></div></footer>
  </main>;
}
