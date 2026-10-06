"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BedDouble, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { TipoHabitacion } from "@/lib/types";
import { InfoBox } from "@/components/ui";

const fotoHabitacion = (tipo: string) => {
  const nombre = tipo.toLocaleLowerCase("es-AR");
  if (nombre.includes("suite")) return { imagen: "https://images.pexels.com/photos/5883728/pexels-photo-5883728.jpeg?auto=compress&dpr=1&h=750&w=1260", fuente: "https://www.pexels.com/photo/interior-of-a-hotel-room-5883728/" };
  if (nombre.includes("doble")) return { imagen: "https://images.pexels.com/photos/6186815/pexels-photo-6186815.jpeg?auto=compress&dpr=1&h=750&w=1260", fuente: "https://www.pexels.com/photo/interior-of-modern-bedroom-in-hotel-6186815/" };
  return { imagen: "https://images.pexels.com/photos/8082564/pexels-photo-8082564.jpeg?auto=compress&dpr=1&h=750&w=1260", fuente: "https://www.pexels.com/photo/interior-of-a-hotel-room-8082564/" };
};

function ImagenHabitacion({ tipo }: { tipo: string }) {
  const foto = fotoHabitacion(tipo);
  return <div className="relative h-56 overflow-hidden bg-[#ded5c7]">
    <img src={foto.imagen} alt={`Imagen ilustrativa de una habitación ${tipo} del Hotel Alejandro I`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"/>
    <div className="absolute inset-0 bg-gradient-to-t from-carbon/40 via-transparent to-transparent"/>
    <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 text-[9px] font-semibold uppercase tracking-[.16em] text-carbon/70">Imagen ilustrativa</span>
    <a href={foto.fuente} target="_blank" rel="noreferrer" className="absolute bottom-4 right-3 text-[10px] text-white underline underline-offset-2">Foto: Pexels</a>
  </div>;
}

const moneda = (precio: string | number, monedaTarifa?: string | null) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: monedaTarifa || "ARS", maximumFractionDigits: 0 }).format(Number(precio));

export function GaleriaHabitaciones() {
  const [tipos, setTipos] = useState<TipoHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    api.get<TipoHabitacion[]>("/tipos-habitacion?estado=ACTIVO")
      .then(setTipos)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar las habitaciones."))
      .finally(() => setCargando(false));
  }, []);

  const visibles = verTodos ? tipos : tipos.slice(0, 3);

  return <section id="habitaciones" className="scroll-mt-8 bg-[#f2eee7] px-5 py-16 md:px-10 md:py-24">
    <div className="mx-auto max-w-7xl">
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between md:mb-14">
        <div className="max-w-2xl">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.24em] text-[#a67d4b]">Tu descanso en Salta</p>
          <h2 className="font-serif text-3xl uppercase leading-tight tracking-wide text-[#26343a] sm:text-4xl">Habitaciones y suites</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-carbon/65 sm:text-base">
            Conocé las opciones de alojamiento del Hotel Alejandro I. Encontrá el espacio que mejor acompaña tu estadía.
          </p>
        </div>
        {tipos.length > 3 && <button type="button" onClick={() => setVerTodos((v) => !v)} className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-gold px-8 text-xs font-semibold uppercase tracking-[.14em] text-carbon transition hover:bg-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          {verTodos ? "Ver menos" : "Ver todos"}
        </button>}
      </div>

      {error && <div className="mb-6"><InfoBox tipo="error">{error}</InfoBox></div>}
      {cargando ? <div className="grid gap-7 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="animate-pulse"><div className="h-56 rounded-sm bg-[#e2dbcf]"/><div className="mt-5 h-5 w-2/3 bg-[#e2dbcf]"/><div className="mt-3 h-4 bg-[#e2dbcf]"/></div>)}</div>
        : visibles.length ? <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{visibles.map((tipo) => <article key={tipo.room_type_id} className="group min-w-0">
          <div className="overflow-hidden shadow-sm"><ImagenHabitacion tipo={tipo.room_type_name}/></div>
          <div className="pt-5">
            <div className="flex items-start justify-between gap-3"><h3 className="font-serif text-xl uppercase leading-snug text-[#26343a]">{tipo.room_type_name}</h3>{tipo.current_price != null && <span className="shrink-0 text-xs font-medium text-[#9a7044]">{moneda(tipo.current_price, tipo.current_currency)} <span className="text-carbon/45">/ noche</span></span>}</div>
            <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-carbon/65">{tipo.room_type_description || "Una opción cómoda para descansar y disfrutar tu visita a Salta."}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-carbon/55"><Users size={15} className="text-[#a67d4b]"/> Hasta {tipo.room_type_max_capacity} huéspedes <span className="text-[#c9bba8]">·</span><BedDouble size={15} className="text-[#a67d4b]"/>{tipo.rooms_count} {tipo.rooms_count === 1 ? "unidad" : "unidades"} en el hotel</div>
            <Link href="#disponibilidad" className="mt-5 inline-flex items-center gap-2 border-b border-[#e8883f] pb-1 text-[11px] font-semibold uppercase tracking-[.16em] text-[#d97831] transition hover:gap-3">Ver más <ArrowRight size={14}/></Link>
          </div>
        </article>)}</div> : <div className="rounded-xl border border-[#e4ddd1] bg-white px-6 py-10 text-center text-sm text-carbon/60">Todavía no hay tipos de habitación activos para mostrar.</div>}
    </div>
  </section>;
}
