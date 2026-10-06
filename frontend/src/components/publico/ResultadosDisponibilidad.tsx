"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BedDouble, CalendarDays, Check, MapPin, Pencil, Search, ShieldCheck, Users } from "lucide-react";
import { Button, EmptyState, InfoBox, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type HabitacionPublica = { habitacion_id: number; tipo_id: number; tipo: string; descripcion: string | null; capacidad: number; fotografias: string[]; cantidad_disponible: number; precio_por_noche: number; noches: number; total: number };
type Resultado = { contrato: { desde: string; hasta: string; huespedes: number; noches: number }; total_tipos: number; total_disponibles: number; habitaciones: HabitacionPublica[] };
const moneda = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fecha = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
const isoLocal = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const fotoHabitacion = (tipo: string) => {
  const nombre = tipo.toLocaleLowerCase("es-AR");
  if (nombre.includes("suite")) return "https://images.pexels.com/photos/5883728/pexels-photo-5883728.jpeg?auto=compress&dpr=1&h=750&w=1260";
  if (nombre.includes("doble")) return "https://images.pexels.com/photos/6186815/pexels-photo-6186815.jpeg?auto=compress&dpr=1&h=750&w=1260";
  return "https://images.pexels.com/photos/8082564/pexels-photo-8082564.jpeg?auto=compress&dpr=1&h=750&w=1260";
};
const fuenteFoto = (tipo: string) => tipo.toLocaleLowerCase("es-AR").includes("suite")
  ? "https://www.pexels.com/photo/interior-of-a-hotel-room-5883728/"
  : tipo.toLocaleLowerCase("es-AR").includes("doble")
    ? "https://www.pexels.com/photo/interior-of-modern-bedroom-in-hotel-6186815/"
    : "https://www.pexels.com/photo/interior-of-a-hotel-room-8082564/";

export function ResultadosDisponibilidad() {
  const router = useRouter();
  const params = useSearchParams();
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  const huespedes = params.get("huespedes") ?? "";
  const [editando, setEditando] = useState(false);
  const [nuevoDesde, setNuevoDesde] = useState(desde);
  const [nuevoHasta, setNuevoHasta] = useState(hasta);
  const [nuevosHuespedes, setNuevosHuespedes] = useState(huespedes);
  const [errorEdicion, setErrorEdicion] = useState("");
  const query = useMemo(() => new URLSearchParams({ desde, hasta, huespedes }), [desde, hasta, huespedes]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setNuevoDesde(desde);
    setNuevoHasta(hasta);
    setNuevosHuespedes(huespedes);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta <= desde || !/^\d+$/.test(huespedes) || Number(huespedes) < 1) {
      setError("La búsqueda no tiene fechas o cantidad de huéspedes válidas. Volvé al inicio para intentarlo otra vez.");
      setCargando(false);
      return () => controller.abort();
    }
    setCargando(true);
    setError("");
    api.get<Resultado>(`/publico/disponibilidad?${query}`, { signal: controller.signal })
      .then(setResultado)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof ApiError ? err.message : "No se pudo consultar la disponibilidad. Intentá nuevamente.");
      })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [desde, hasta, huespedes, query]);

  function actualizarBusqueda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorEdicion("");
    if (!nuevoDesde || !nuevoHasta || nuevoHasta <= nuevoDesde) {
      setErrorEdicion("Elegí una fecha de salida posterior a la fecha de llegada.");
      return;
    }
    if (!/^\d+$/.test(nuevosHuespedes) || Number(nuevosHuespedes) < 1) {
      setErrorEdicion("Ingresá una cantidad válida de huéspedes.");
      return;
    }
    setEditando(false);
    router.push(`/web/disponibilidad?${new URLSearchParams({ desde: nuevoDesde, hasta: nuevoHasta, huespedes: nuevosHuespedes })}`);
  }

  function elegir(h: HabitacionPublica) {
    sessionStorage.setItem("hotelAlejandro.seleccionECO01", JSON.stringify({ desde, hasta, huespedes: Number(huespedes), habitacion_id: h.habitacion_id, tipo_id: h.tipo_id, tipo: h.tipo, precio_por_noche: h.precio_por_noche, noches: h.noches, total: h.total }));
    setSeleccionada(h.tipo_id);
  }

  return <main className="min-h-screen bg-[#f7f4ee] text-carbon">
    <header className="bg-[#202d33] text-bone"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-10">
      <Link href="/web" aria-label="Hotel Alejandro I, inicio"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={210} height={40} priority/></Link>
      <Link href="/web/consulta" className="rounded-full border border-gold/60 px-4 py-2.5 text-xs text-bone transition hover:bg-gold hover:text-carbon sm:text-sm">Mi reserva</Link>
    </div></header>
    <section className="bg-[#26343a] text-bone"><div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
      <button type="button" aria-expanded={editando} aria-controls="editar-disponibilidad" onClick={() => { setEditando((abierta) => !abierta); setErrorEdicion(""); }} className="inline-flex items-center gap-2 text-xs text-white/65 transition hover:text-white"><Pencil size={14}/>{editando ? "Cerrar edición" : "Editar búsqueda"}</button>
      <div className="mt-6 flex items-end justify-between gap-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#dfbd84]">Tu estadía en Salta</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">Habitaciones disponibles</h1>
        {resultado && <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/65"><span className="inline-flex items-center gap-2"><CalendarDays size={15}/>{fecha(resultado.contrato.desde)} — {fecha(resultado.contrato.hasta)}</span><span className="inline-flex items-center gap-2"><Users size={15}/>{resultado.contrato.huespedes} huéspedes</span></p>}
      </div><span className="hidden items-center gap-2 text-xs text-white/55 sm:inline-flex"><MapPin size={14}/> Salta Capital</span></div>
      {editando && <form id="editar-disponibilidad" onSubmit={actualizarBusqueda} className="mt-7 grid gap-4 rounded-xl border border-white/15 bg-white/5 p-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_.7fr_auto] md:items-end">
        <label className="block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-white/65"><CalendarDays size={14}/> Llegada</span><Input type="date" min={isoLocal(new Date())} value={nuevoDesde} onChange={(e) => setNuevoDesde(e.target.value)} required className="h-11 border-white/20 bg-white text-carbon"/></label>
        <label className="block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-white/65"><CalendarDays size={14}/> Salida</span><Input type="date" min={nuevoDesde} value={nuevoHasta} onChange={(e) => setNuevoHasta(e.target.value)} required className="h-11 border-white/20 bg-white text-carbon"/></label>
        <label className="block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-white/65"><Users size={14}/> Huéspedes</span><Input type="number" min="1" step="1" value={nuevosHuespedes} onChange={(e) => setNuevosHuespedes(e.target.value)} required className="h-11 border-white/20 bg-white text-carbon"/></label>
        <Button type="submit" cargando={cargando} className="h-11 px-5"><Search size={15}/> Actualizar búsqueda</Button>
        {errorEdicion && <p role="alert" className="text-xs text-[#ffd2c9] sm:col-span-2 md:col-span-4">{errorEdicion}</p>}
      </form>}
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-14">
      {cargando && <div role="status" className="rounded-2xl border border-[#e8e0d4] bg-white p-10 text-center text-sm text-carbon/60">Buscando habitaciones disponibles…</div>}
      {!cargando && error && <InfoBox tipo="error">{error}</InfoBox>}
      {!cargando && !error && resultado && <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-carbon/60">{resultado.total_disponibles} habitaciones en {resultado.total_tipos} tipos disponibles</p><p className="inline-flex items-center gap-2 text-xs text-carbon/50"><ShieldCheck size={15} className="text-[#7b8d72]"/> Disponibilidad para toda tu estadía</p></div>
        {!resultado.habitaciones.length ? <div className="rounded-2xl border border-[#e8e0d4] bg-white"><EmptyState titulo="No encontramos habitaciones disponibles" descripcion="Probá con otras fechas o una cantidad diferente de huéspedes."/></div> : <div className="grid gap-5 lg:grid-cols-2">
          {resultado.habitaciones.map((h) => <article key={h.tipo_id} className="overflow-hidden rounded-2xl border border-[#e8e0d4] bg-white shadow-[0_10px_34px_#17252a0a]">
            <div className="relative h-52 overflow-hidden bg-[#ded5c7]"><img src={h.fotografias[0] || fotoHabitacion(h.tipo)} alt={`Imagen ilustrativa de una habitación tipo ${h.tipo}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"/><div className="absolute inset-0 bg-gradient-to-t from-carbon/35 via-transparent to-transparent"/><span className="absolute bottom-4 left-4 rounded-full border border-white/50 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-carbon">Imagen ilustrativa</span><a href={fuenteFoto(h.tipo)} target="_blank" rel="noreferrer" className="absolute bottom-5 right-4 text-[10px] text-white underline underline-offset-2">Foto: Pexels</a></div>
            <div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#a67d4b]">Alojamiento</p><h2 className="mt-1 font-serif text-2xl">{h.tipo}</h2></div><span className="rounded-full bg-[#edf2ec] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#56725c]">{h.cantidad_disponible} disponibles</span></div>
              <p className="mt-3 min-h-10 text-sm leading-6 text-carbon/60">{h.descripcion || "Un espacio sereno para descansar y disfrutar tu visita a Salta."}</p>
              <div className="mt-4 flex items-center gap-2 border-t border-[#eee8de] pt-4 text-xs text-carbon/55"><Users size={15} className="text-[#a67d4b]"/> Hasta {h.capacidad} huéspedes <span className="mx-1 text-[#d6caba]">·</span><BedDouble size={15} className="text-[#a67d4b]"/> {h.noches} noches</div>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[#eee8de] pt-5"><div><p className="text-xs text-carbon/50">{moneda(h.precio_por_noche)} <span className="text-carbon/40">/ noche</span></p><p className="mt-1 font-serif text-2xl">{moneda(h.total)} <span className="font-sans text-xs text-carbon/45">total estadía</span></p></div><Button type="button" onClick={() => elegir(h)} className="rounded-md px-5">{seleccionada === h.tipo_id ? <><Check size={16}/> Elegida</> : "Elegir este tipo"}</Button></div>
            </div></article>)}
        </div>}
      </>}
      {seleccionada !== null && <div className="mt-6"><InfoBox tipo="exito">Guardamos tu elección y los datos de la estadía para continuar.</InfoBox></div>}
    </section>
    <footer className="mt-8 bg-[#171c1f] text-bone"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-bone/50 sm:flex-row sm:items-center sm:justify-between md:px-10"><span>© Hotel Alejandro I · Salta Capital, Argentina</span><Link href="/web" className="hover:text-white">Volver al hotel</Link></div></footer>
  </main>;
}
