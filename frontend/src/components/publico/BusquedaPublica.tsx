"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Compass, MapPin, ShieldCheck, Users } from "lucide-react";
import { Button, InfoBox, Input } from "@/components/ui";
import { GaleriaHabitaciones } from "@/components/publico/GaleriaHabitaciones";

const isoLocal = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");

function PaisajeSalta() {
  return <svg viewBox="0 0 720 530" role="img" aria-label="Ilustración de los cerros de Salta al atardecer" className="h-full w-full"><defs>
    <linearGradient id="cielo-salta" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#30414a"/><stop offset=".62" stopColor="#c38b67"/><stop offset="1" stopColor="#edc392"/></linearGradient>
    <linearGradient id="cerro-uno" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#b77250"/><stop offset="1" stopColor="#714f4a"/></linearGradient><linearGradient id="cerro-dos" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d49b6e"/><stop offset="1" stopColor="#8b5d50"/></linearGradient>
  </defs><rect width="720" height="530" fill="url(#cielo-salta)"/><circle cx="522" cy="145" r="60" fill="#f5d7a3" opacity=".9"/><circle cx="522" cy="145" r="82" fill="#f5d7a3" opacity=".13"/>
    <path d="M0 315 89 247l45 29 82-119 70 93 70-55 76 91 88-123 73 103 65-57 62 50v271H0Z" fill="#725854" opacity=".55"/><path d="m0 367 108-94 68 40 93-117 93 121 81-62 110 111 67-61 100 55v170H0Z" fill="url(#cerro-uno)"/><path d="m0 411 125-77 75 37 93-63 94 50 93-46 110 66 63-36 67 33v155H0Z" fill="url(#cerro-dos)"/><path d="M0 438c112-34 193 24 303-2s196-32 417 8v86H0Z" fill="#31434a"/><path d="M0 477c109-28 184 19 299 0s215-24 421 6v47H0Z" fill="#27383f"/><path d="M77 405c82-17 156-14 232 0M423 388c80-16 155-10 234 7" fill="none" stroke="#efc494" strokeOpacity=".45" strokeWidth="2"/><path d="M462 246c28-9 49-8 75 0M120 226c23-7 39-6 58 0" fill="none" stroke="#fff4de" strokeOpacity=".45" strokeWidth="2"/>
  </svg>;
}

export function BusquedaPublica() {
  const hoy = isoLocal(new Date()); const manana = new Date(); manana.setDate(manana.getDate() + 1);
  const [desde, setDesde] = useState(hoy); const [hasta, setHasta] = useState(isoLocal(manana)); const [huespedes, setHuespedes] = useState("2");
  const router = useRouter();
  const [error, setError] = useState(""); const [cargando, setCargando] = useState(false);
  async function buscar(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!desde || !hasta || !huespedes) return setError("Completá fechas y cantidad de huéspedes.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta <= desde) return setError("Ingresá fechas válidas y una salida posterior al ingreso.");
    if (!Number.isInteger(Number(huespedes)) || Number(huespedes) < 1) return setError("La cantidad de huéspedes debe ser mayor a cero.");
    setCargando(true);
    router.push("/web/disponibilidad?" + new URLSearchParams({ desde, hasta, huespedes }).toString());
  }
  return <main className="min-h-screen bg-[#f7f4ee] text-carbon">
    <header className="relative z-10 border-b border-white/10 bg-[#202d33] text-bone"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-10">
      <Link href="/web" aria-label="Hotel Alejandro I, inicio" className="shrink-0"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={210} height={40} priority/></Link>
      <nav className="hidden items-center gap-9 text-[13px] tracking-wide text-bone/75 md:flex"><a href="#hotel" className="transition hover:text-gold-light">El hotel</a><a href="#habitaciones" className="transition hover:text-gold-light">Habitaciones</a><a href="#ubicacion" className="transition hover:text-gold-light">Salta</a></nav>
      <Link href="/web/consulta" className="rounded-full border border-gold/60 px-4 py-2.5 text-xs font-medium tracking-wide text-bone transition hover:bg-gold hover:text-carbon sm:px-5 sm:text-sm">Mi reserva</Link>
    </div></header>
    <section id="hotel" className="relative isolate overflow-hidden bg-[#26343a] text-bone"><div className="absolute inset-0 opacity-75"><PaisajeSalta/></div><div className="absolute inset-0 bg-gradient-to-r from-[#1d292f]/95 via-[#1d292f]/80 to-[#1d292f]/10"/>
      <div className="relative mx-auto grid min-h-[510px] max-w-7xl items-center px-5 py-16 md:min-h-[570px] md:grid-cols-[1.08fr_.92fr] md:px-10 md:py-20">
        <div className="max-w-2xl"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-carbon/25 px-4 py-2 text-[11px] uppercase tracking-[.2em] text-gold-light"><MapPin size={13}/> Salta · Argentina</div><p className="mb-4 text-xs font-medium uppercase tracking-[.28em] text-white/60">Una pausa en el norte</p><h1 className="max-w-xl font-serif text-5xl leading-[1.04] tracking-tight sm:text-6xl lg:text-[72px]">Tu lugar para<br/><span className="italic text-[#e4bd82]">descubrir Salta.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/75">Te esperamos en Hotel Alejandro I. Elegí tus fechas y encontrá la habitación ideal para tu viaje.</p><a href="#disponibilidad" className="mt-9 inline-flex items-center gap-3 text-sm font-medium text-white transition hover:text-gold-light">Encontrá tu estadía <span className="grid h-9 w-9 place-items-center rounded-full border border-white/40"><ArrowDown size={15}/></span></a></div>
        <div className="hidden justify-end md:flex"><div className="w-64 border-l border-white/30 py-2 pl-6 text-sm leading-6 text-white/70"><Compass size={19} className="mb-4 text-gold-light"/><p className="font-serif text-xl text-white">Salta te espera</p><p className="mt-2">Una ciudad de historia, paisajes y hospitalidad en el corazón del norte argentino.</p></div></div><div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f7f4ee] to-transparent"/>
      </div>
    </section>
    <section id="disponibilidad" className="relative z-10 mx-auto -mt-14 max-w-7xl px-4 sm:px-6 md:-mt-16 md:px-10"><div className="rounded-2xl border border-[#e8e0d4] bg-white p-5 shadow-[0_22px_70px_#17252a1c] sm:p-7 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#a67d4b]">Planificá tu visita</p><h2 className="mt-1 font-serif text-2xl text-carbon sm:text-3xl">Buscá disponibilidad</h2></div><span className="hidden text-xs text-carbon/45 sm:block">Mejor estadía, sin vueltas.</span></div>
      <form onSubmit={buscar} className="grid gap-4 md:grid-cols-[1fr_1fr_.8fr_auto] md:items-end">
        <label htmlFor="eco-desde" className="group block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-carbon/55"><CalendarDays size={14} className="text-[#a67d4b]"/> Llegada</span><Input id="eco-desde" type="date" min={hoy} value={desde} onChange={e => setDesde(e.target.value)} required className="h-12 border-[#e5ded3] bg-[#fbfaf7] px-3 text-sm"/></label>
        <label htmlFor="eco-hasta" className="group block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-carbon/55"><CalendarDays size={14} className="text-[#a67d4b]"/> Salida</span><Input id="eco-hasta" type="date" min={desde || hoy} value={hasta} onChange={e => setHasta(e.target.value)} required className="h-12 border-[#e5ded3] bg-[#fbfaf7] px-3 text-sm"/></label>
        <label htmlFor="eco-huespedes" className="group block"><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-carbon/55"><Users size={14} className="text-[#a67d4b]"/> Huéspedes</span><span className="relative block"><Input id="eco-huespedes" type="number" min="1" step="1" value={huespedes} onChange={e => setHuespedes(e.target.value)} required className="h-12 border-[#e5ded3] bg-[#fbfaf7] px-3 pr-10 text-sm"/><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-carbon/40"/></span></label>
        <Button type="submit" cargando={cargando} className="h-12 w-full rounded-md px-7 md:w-auto">Consultar <ArrowRight size={16}/></Button>
      </form>{error && <div className="mt-4"><InfoBox tipo="error">{error}</InfoBox></div>}
    </div></section>
    <GaleriaHabitaciones />
    <section id="resultados" className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <div className="grid gap-10 md:grid-cols-[.85fr_1.15fr] md:items-center"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#a67d4b]">Descanso con esencia salteña</p><h2 className="mt-3 max-w-sm font-serif text-3xl leading-tight sm:text-4xl">Una estadía que empieza con una buena elección.</h2><p className="mt-4 max-w-md text-sm leading-7 text-carbon/60">Consultá la disponibilidad para tus fechas. Vas a ver opciones reales, capacidad y el precio estimado de tu estadía.</p><div className="mt-6 flex items-center gap-3 text-xs text-carbon/55"><ShieldCheck size={17} className="text-[#a67d4b]"/> Información clara antes de elegir.</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[#e9e1d5] p-6 sm:p-7"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[#9b7548]"><CalendarDays size={18}/></span><p className="mt-8 font-serif text-xl">Tus fechas</p><p className="mt-2 text-sm leading-6 text-carbon/60">Ingresá llegada y salida para consultar opciones disponibles.</p></div><div className="rounded-2xl bg-[#e5e9e2] p-6 sm:p-7 sm:translate-y-8"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/75 text-[#647762]"><Users size={18}/></span><p className="mt-8 font-serif text-xl">Tu espacio</p><p className="mt-2 text-sm leading-6 text-carbon/60">La capacidad de cada habitación se ajusta a tu grupo.</p></div></div>
      </div>
    </section>
    <footer id="ubicacion" className="bg-[#171c1f] text-bone">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.15fr_.85fr] md:px-10 md:py-20">
        <section>
          <Image src="/logo-header.svg" alt="Hotel Alejandro I" width={230} height={44}/>
          <p className="mt-7 max-w-xl text-sm leading-7 text-bone/65">
            Un lugar para descansar y disfrutar tu visita al norte argentino. Te esperamos en Salta Capital.
          </p>
          <Link href="#hotel" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#e5a166] transition hover:text-gold-light">
            Conocé el hotel <ArrowUpRight size={15}/>
          </Link>
        </section>
        <section className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-xl uppercase tracking-wide">Ubicación</h2>
            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-bone/70">
              <MapPin size={17} className="mt-1 shrink-0 text-[#e5a166]"/>
              <p>Salta Capital<br/>Provincia de Salta, Argentina</p>
            </div>
            <p className="mt-3 pl-8 text-xs leading-5 text-bone/45">Consultá disponibilidad para planificar tu estadía.</p>
          </div>
          <div>
            <h2 className="font-serif text-xl uppercase tracking-wide">Tu estadía</h2>
            <nav className="mt-6 flex flex-col items-start gap-4 text-sm text-bone/70">
              <Link href="#disponibilidad" className="transition hover:text-[#e5a166]">Buscar habitaciones</Link>
              <Link href="/web/consulta" className="transition hover:text-[#e5a166]">Consultar una reserva</Link>
              <Link href="#habitaciones" className="transition hover:text-[#e5a166]">Habitaciones y suites</Link>
            </nav>
          </div>
        </section>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-[11px] text-bone/40 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <p>© Hotel Alejandro I · Salta Capital, Argentina</p>
          <a href="#hotel" className="inline-flex items-center gap-2 transition hover:text-bone/75">Volver al inicio <ArrowDown size={13} className="rotate-180"/></a>
        </div>
      </div>
    </footer>
  </main>;
}
