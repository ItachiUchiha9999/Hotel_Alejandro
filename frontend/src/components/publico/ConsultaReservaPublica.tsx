"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, CalendarDays, CircleCheck, Clock3, CreditCard, FileSearch, Mail, MapPin, Phone, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Button, InfoBox, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Detalle = {
  codigo: string; huesped: string; documento: string; fecha_ingreso: string; fecha_salida: string;
  hora_llegada: string | null; huespedes: number; habitacion: string; tipo_habitacion: string; total: number; estado: string;
  abonado: number; saldo: number; pagos: { importe: number; fecha: string; metodo: string; tarjeta_ultimos4: string | null; simulado: boolean }[];
  medios_pago: { payment_method_id: number; payment_method: string }[];
  cancelable: boolean; cancelacion: null | { condiciones: string; horas_cancelacion_sin_cargo: number; porcentaje_penalidad: number; penalidad: number };
};
const moneda = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fecha = (v: string) => new Date(v.slice(0, 10) + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
function validarDatosTarjeta(titular: string, numeroIngresado: string, vencimiento: string, codigo: string) {
  if (titular.trim().length < 3 || !/^[\p{L}\p{M} .'-]+$/u.test(titular.trim())) return "Ingresá el nombre del titular con al menos 3 letras.";
  const digitos = numeroIngresado.replace(/\D/g, "");
  if (digitos.length < 13 || digitos.length > 19) return "El número de tarjeta debe tener entre 13 y 19 dígitos.";
  let suma = 0; let duplicar = false;
  for (let indice = digitos.length - 1; indice >= 0; indice--) {
    let digito = Number(digitos[indice]);
    if (duplicar) { digito *= 2; if (digito > 9) digito -= 9; }
    suma += digito; duplicar = !duplicar;
  }
  if (suma % 10 !== 0) return "Revisá el número de tarjeta; los dígitos no son válidos.";
  const coincidencia = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(vencimiento);
  if (!coincidencia) return "El vencimiento debe tener formato MM/AA.";
  const mes = Number(coincidencia[1]); const anio = 2000 + Number(coincidencia[2]); const ahora = new Date();
  if (anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1)) return "La tarjeta está vencida.";
  if (!/^\d{3,4}$/.test(codigo)) return "El código de seguridad debe tener 3 o 4 dígitos.";
  return "";
}

export function ConsultaReservaPublica() {
  const [codigo, setCodigo] = useState(""); const [documento, setDocumento] = useState("");
  const [reserva, setReserva] = useState<Detalle | null>(null); const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false); const [cargando, setCargando] = useState(false); const [cancelando, setCancelando] = useState(false);
  const [medioPago, setMedioPago] = useState(""); const [pagando, setPagando] = useState(false);
  const [titularTarjeta, setTitularTarjeta] = useState(""); const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [vencimientoTarjeta, setVencimientoTarjeta] = useState(""); const [codigoTarjeta, setCodigoTarjeta] = useState("");
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
  async function pagarPrueba() {
    if (!reserva || !medioPago) return;
    const metodoElegido = reserva.medios_pago.find(medio => medio.payment_method_id === Number(medioPago))?.payment_method || "";
    if (metodoElegido.toUpperCase().includes("TARJETA")) {
      const errorTarjeta = validarDatosTarjeta(titularTarjeta, numeroTarjeta, vencimientoTarjeta, codigoTarjeta);
      if (errorTarjeta) { setError(errorTarjeta); return; }
    }
    setPagando(true); setError("");
    try {
      const cardLast4 = metodoElegido.toUpperCase().includes("TARJETA") ? numeroTarjeta.replace(/\D/g, "").slice(-4) : undefined;
      await api.post(`/publico/reservas/${encodeURIComponent(reserva.codigo)}/pago-prueba`, { documento, paymentMethodId: Number(medioPago), cardLast4 });
      setTitularTarjeta(""); setNumeroTarjeta(""); setVencimientoTarjeta(""); setCodigoTarjeta("");
      setReserva(await api.post<Detalle>("/publico/reservas/consultar", { codigo: reserva.codigo, documento }));
    } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago de prueba."); }
    finally { setPagando(false); }
  }
  const medioActual = reserva?.medios_pago.find(medio => medio.payment_method_id === Number(medioPago || reserva.medios_pago[0]?.payment_method_id));
  const requiereTarjeta = medioActual?.payment_method.toUpperCase().includes("TARJETA") ?? false;
  const alojamientoPagado = Boolean(reserva && reserva.abonado > 0 && reserva.saldo <= 0.001);
  const estadoVisible = !reserva ? "" : reserva.estado === "CANCELADA" ? "CANCELADA"
    : reserva.estado === "PENDIENTE" ? "PENDIENTE DE CONFIRMACIÓN"
    : alojamientoPagado ? "PAGADA"
    : reserva.estado === "CONFIRMADA" ? "CONFIRMADA"
    : reserva.estado === "IN_HOUSE" ? "ESTADÍA EN CURSO"
    : reserva.estado === "FINALIZADA" ? "ESTADÍA FINALIZADA"
    : reserva.estado.replaceAll("_", " ");
  const ayudaEstado = !reserva ? "" : reserva.estado === "CANCELADA" ? "La reserva está cancelada. Si creés que es un error, contactá al hotel."
    : reserva.estado === "PENDIENTE" ? "El hotel debe revisar y confirmar la reserva. Te avisaremos al correo que ingresaste; mientras tanto podés solicitar la cancelación."
    : alojamientoPagado ? "El alojamiento figura pagado. Conservá el código de reserva y el detalle del medio de pago."
    : reserva.estado === "CONFIRMADA" ? "La reserva está confirmada. Podés consultar el saldo y registrar el medio de pago desde esta página."
    : reserva.estado === "IN_HOUSE" ? "Tu estadía está en curso. Los saldos o consumos pendientes se revisan con recepción."
    : reserva.estado === "FINALIZADA" ? "La estadía finalizó. Para consultar saldos o comprobantes, comunicate con el hotel."
    : "Consultá con el hotel si necesitás información sobre el estado de la reserva.";
  return <main id="contenido-principal" className="min-h-screen bg-[#f7f4ee] text-carbon">
    <a href="#contenido-principal" className="sr-only z-50 rounded-md bg-white px-4 py-3 text-[#17252a] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#805b2d]">Saltar al contenido principal</a>
    <header className="border-b border-white/10 bg-[#202d33] text-bone"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 md:px-10">
      <Link href="/web" aria-label="Hotel Alejandro I, inicio" className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={210} height={40}/></Link>
      <Link href="/web" className="rounded-full border border-gold/60 px-4 py-2.5 text-sm text-bone transition hover:bg-gold hover:text-carbon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Volver al hotel</Link>
    </div></header>
    <section className="relative overflow-hidden bg-[#26343a] text-bone"><div className="absolute -right-12 -top-32 h-96 w-96 rounded-full border border-gold/15"/><div className="absolute -right-4 -top-24 h-80 w-80 rounded-full border border-gold/10"/><div className="relative mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[.24em] text-[#dfbd84]">Atención a huéspedes</p><h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">Tu reserva, siempre a mano.</h1><p className="mt-4 max-w-xl text-base leading-7 text-white/80">Consultá los detalles de tu estadía o revisá las condiciones para cancelarla.</p>
    </div></section>
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[.72fr_1.28fr] md:px-10 md:py-14">
      <aside className="space-y-5"><div className="rounded-2xl border border-[#e8e0d4] bg-white p-6 shadow-sm"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#f3eadb] text-[#805b2d]"><FileSearch size={20}/></div><h2 className="mt-5 font-serif text-xl">Encontrá tu estadía</h2><p className="mt-2 text-sm leading-6 text-[#514d46]">Ingresá el código de reserva y el documento utilizado al registrarla. Solo vos podrás ver sus datos.</p></div>
        <div className="flex gap-3 rounded-2xl border border-[#e8e0d4] bg-[#f0eee7] p-5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#506344]"/><p className="text-sm leading-6 text-[#514d46]">La consulta valida ambos datos antes de mostrar la información de la reserva.</p></div>
        <section aria-labelledby="ayuda-reserva" className="rounded-2xl border border-[#e8e0d4] bg-white p-6 shadow-sm"><h2 id="ayuda-reserva" className="font-serif text-xl">¿Necesitás ayuda?</h2><p className="mt-2 text-sm leading-6 text-[#514d46]">Si la reserva o un pago no aparecen actualizados, no repitas el pago. Contactanos con tu código de reserva.</p><div className="mt-4 space-y-3 text-sm"><a href="tel:+543874001234" className="flex items-center gap-3 text-[#344b58] underline decoration-[#a67d4b] underline-offset-4 hover:text-[#17252a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#805b2d]"><Phone size={17} aria-hidden="true"/>+54 387 400-1234</a><a href="mailto:reservas@hotelalejandro.com" className="flex items-center gap-3 break-all text-[#344b58] underline decoration-[#a67d4b] underline-offset-4 hover:text-[#17252a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#805b2d]"><Mail size={17} aria-hidden="true"/>reservas@hotelalejandro.com</a></div></section>
      </aside>
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#e8e0d4] bg-white p-5 shadow-[0_14px_40px_#17252a0a] sm:p-8">
          <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#805b2d]">Consulta segura</p><h2 className="mt-1 font-serif text-2xl">Ingresá tus datos</h2></div>
          <form onSubmit={consultar} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="eco-codigo" className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#514d46]">Código de reserva</span><Input id="eco-codigo" name="codigo-reserva" autoComplete="off" maxLength={20} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej. HA-000123" required aria-describedby="ayuda-codigo" className="h-12 bg-[#fbfaf7] placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/><span id="ayuda-codigo" className="sr-only">Ingresá el código que recibiste al reservar.</span></label>
            <label htmlFor="eco-documento" className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#514d46]">Documento del huésped</span><Input id="eco-documento" name="documento-huesped" autoComplete="off" maxLength={30} value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Número de documento" required aria-describedby="ayuda-documento" className="h-12 bg-[#fbfaf7] placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/><span id="ayuda-documento" className="sr-only">Usá el documento ingresado al registrar la reserva.</span></label>
          </div>{error && <InfoBox tipo="error">{error}</InfoBox>}<div className="flex justify-end"><Button type="submit" cargando={cargando} className="rounded-md px-6">Consultar reserva</Button></div></form>
        </section>
        {reserva && <section aria-labelledby="resultado-reserva" className="overflow-hidden rounded-2xl border border-[#e8e0d4] bg-white shadow-[0_14px_40px_#17252a0a]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eee8de] bg-[#fcfbf8] px-5 py-5 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#805b2d]">Estado de la reserva</p><h2 id="resultado-reserva" className="mt-1 font-serif text-2xl">Reserva {reserva.codigo}</h2><p className="mt-1 text-sm text-[#514d46]">{reserva.tipo_habitacion}</p></div><span role="status" aria-label={`Estado: ${estadoVisible}`} className={"rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[.08em] " + (reserva.estado === "CANCELADA" ? "bg-[#f7e9e5] text-[#8d352c]" : reserva.estado === "PENDIENTE" ? "bg-[#fff2d7] text-[#694500]" : alojamientoPagado ? "bg-[#e7f1e7] text-[#365b3b]" : "bg-[#edf2ec] text-[#365b3b]")}>{estadoVisible}</span></div>
          <div className="border-b border-[#eee8de] px-5 py-4 sm:px-8"><p className="text-sm leading-6 text-[#3f3b35]">{ayudaEstado}</p></div>
          <div className="grid gap-px bg-[#eee8de] sm:grid-cols-2"><div className="bg-white p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Huésped</p><p className="mt-1 font-medium">{reserva.huesped}</p><p className="text-sm text-[#514d46]">{reserva.documento}</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Viajeros</p><p className="mt-1 flex items-center gap-2 font-medium"><Users size={15} className="text-[#805b2d]"/>{reserva.huespedes} huéspedes</p></div><div className="bg-white p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Ingreso</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays size={15} className="text-[#805b2d]"/>{fecha(reserva.fecha_ingreso)}</p></div>{reserva.hora_llegada && <div className="bg-white p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Hora de llegada</p><p className="mt-1 flex items-center gap-2 font-medium"><Clock3 size={15} className="text-[#805b2d]"/>{reserva.hora_llegada}</p></div>}<div className="bg-white p-5 sm:p-7"><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Salida</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays size={15} className="text-[#805b2d]"/>{fecha(reserva.fecha_salida)}</p></div></div>
          <div className="flex items-end justify-between gap-3 border-t border-[#eee8de] px-5 py-5 sm:px-8"><div><p className="text-xs font-medium uppercase tracking-[.1em] text-[#625d54]">Total de estadía</p><p className="mt-1 font-serif text-2xl">{moneda(reserva.total)}</p></div><span className="text-right text-sm text-[#514d46]">{reserva.tipo_habitacion}</span></div>
          <div className="border-t border-[#eee8de] bg-[#fcfbf8] px-5 py-6 sm:px-8">
            <div className="flex items-center gap-2"><CreditCard size={18} className="text-[#a67d4b]"/><h3 className="font-serif text-lg">Pagos de la reserva</h3></div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>Abonado: <strong>{moneda(reserva.abonado)}</strong></span><span>Saldo: <strong>{moneda(reserva.saldo)}</strong></span></div>
            {reserva.pagos.length > 0 && <ul className="mt-4 space-y-2">{reserva.pagos.map((pago, indice) => <li key={`${pago.fecha}-${indice}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-[#eee8de] bg-white px-4 py-3 text-sm"><span>{pago.metodo}{pago.tarjeta_ultimos4 && <span className="text-[#514d46]"> · Terminada en {pago.tarjeta_ultimos4}</span>}</span><strong>{moneda(pago.importe)}</strong></li>)}</ul>}
            {reserva.saldo > 0 && reserva.estado === "CONFIRMADA" && <div className="mt-5 rounded-xl border border-[#e8e0d4] bg-white p-4"><p className="text-sm leading-6 text-[#514d46]">Modo de prueba: se registrará el medio de pago en la reserva, pero no se realizará un cargo real. Si elegís tarjeta, usá datos ficticios; no ingreses una tarjeta real.</p><label htmlFor="medio-pago-reserva" className="mt-4 block text-sm font-medium text-[#3f3b35]">Medio de pago</label><div className="mt-2 flex flex-col gap-3 sm:flex-row"><select id="medio-pago-reserva" value={medioPago || String(reserva.medios_pago[0]?.payment_method_id || "")} onChange={e => setMedioPago(e.target.value)} className="h-11 flex-1 rounded-md border border-[#aaa294] bg-white px-3 text-sm text-[#302d28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805b2d]">{reserva.medios_pago.map(medio => <option key={medio.payment_method_id} value={medio.payment_method_id}>{medio.payment_method}</option>)}</select></div>
              {requiereTarjeta && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-[#3f3b35]">Nombre del titular<Input autoComplete="off" value={titularTarjeta} onChange={e => setTitularTarjeta(e.target.value.replace(/[^\p{L}\p{M} .'-]/gu, ""))} maxLength={80} placeholder="Nombre como figura en la tarjeta" className="mt-1 h-11 placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/></label><label className="text-sm font-medium text-[#3f3b35]">Número de tarjeta<Input autoComplete="off" inputMode="numeric" value={numeroTarjeta} onChange={e => setNumeroTarjeta(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "))} maxLength={23} placeholder="0000 0000 0000 0000" className="mt-1 h-11 placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/></label><label className="text-sm font-medium text-[#3f3b35]">Vencimiento (MM/AA)<Input autoComplete="off" inputMode="numeric" value={vencimientoTarjeta} onChange={e => { const digitos = e.target.value.replace(/\D/g, "").slice(0, 4); setVencimientoTarjeta(digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos); }} maxLength={5} placeholder="MM/AA" className="mt-1 h-11 placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/></label><label className="text-sm font-medium text-[#3f3b35]">Código de seguridad<Input autoComplete="off" inputMode="numeric" value={codigoTarjeta} onChange={e => setCodigoTarjeta(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} placeholder="CVV" className="mt-1 h-11 placeholder:text-[#6b675f] focus-visible:ring-2 focus-visible:ring-[#805b2d]"/></label></div>}
              <div className="mt-4 flex justify-end"><Button type="button" cargando={pagando} onClick={pagarPrueba}><CreditCard size={16}/> Pagar reserva</Button></div></div>}
            {reserva.saldo <= 0 && reserva.pagos.length > 0 && <p className="mt-4 text-sm font-medium text-[#56725c]">La estadía figura abonada en el sistema.</p>}
          </div>
          {reserva.estado === "CANCELADA" && <div className="px-5 pb-6 sm:px-8"><InfoBox tipo="regla">Esta reserva ya fue cancelada.</InfoBox></div>}
          {reserva.cancelable && reserva.cancelacion && <div className="border-t border-[#eee8de] bg-[#fbfaf7] px-5 py-6 sm:px-8"><div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#805b2d]"/><div><h3 className="font-serif text-lg">Condiciones de cancelación</h3><p className="mt-1 text-sm leading-6 text-[#514d46]">{reserva.cancelacion.condiciones}</p></div></div>
            <div className="mt-4 rounded-xl border border-[#e8e0d4] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#625d54]">Penalidad estimada</p><p className="mt-1 font-serif text-2xl">{moneda(reserva.cancelacion.penalidad)} <span className="font-sans text-sm text-[#514d46]">({reserva.cancelacion.porcentaje_penalidad}%)</span></p><p className="mt-1 text-sm text-[#514d46]">Se informa antes de confirmar la cancelación.</p></div>
            {confirmar ? <div className="mt-5 rounded-xl border border-[#ead5ce] bg-[#fbf3f0] p-4"><div className="flex gap-2 text-sm font-medium text-[#8f483e]"><TriangleAlert size={17}/> ¿Confirmás cancelar esta reserva?</div><div className="mt-4 flex flex-wrap justify-end gap-3"><Button variante="secundario" type="button" onClick={() => setConfirmar(false)}>Volver</Button><Button variante="peligro" type="button" cargando={cancelando} onClick={cancelar}>Sí, cancelar reserva</Button></div></div> : <div className="mt-5 flex justify-end"><Button variante="peligro" type="button" onClick={() => setConfirmar(true)}><TriangleAlert size={16}/> Solicitar cancelación</Button></div>}
          </div>}
          {!reserva.cancelable && reserva.estado !== "CANCELADA" && <div className="px-5 pb-6 sm:px-8"><InfoBox tipo="regla">{reserva.abonado > 0 ? "Hay pagos registrados. Para cambios o una posible devolución, comunicate con el hotel." : "Esta reserva no puede cancelarse desde la web por su estado actual. Comunicate con el hotel para recibir ayuda."}</InfoBox></div>}
          {!reserva.cancelable && reserva.estado === "CANCELADA" && <div className="sr-only"><CircleCheck/></div>}
        </section>}
      </div>
    </div>
    <footer className="mt-4 bg-[#171c1f] text-bone">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.15fr_.85fr] md:px-10 md:py-20">
        <section>
          <Link href="/web" aria-label="Hotel Alejandro I, inicio" className="inline-block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]"><Image src="/logo-header.svg" alt="Hotel Alejandro I" width={230} height={44}/></Link>
          <p className="mt-7 max-w-xl text-sm leading-7 text-white/80">Un lugar para descansar y disfrutar tu visita al norte argentino. Te esperamos en Salta Capital.</p>
          <Link href="/web#hotel" className="mt-7 inline-flex items-center gap-2 rounded-sm text-xs font-semibold uppercase tracking-[.15em] text-[#f0a96d] transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Conocé el hotel <ArrowUpRight size={15}/></Link>
        </section>
        <section className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-serif text-xl uppercase tracking-wide">Contacto y ubicación</h2>
            <div className="mt-6 space-y-4 text-sm leading-6 text-white/80">
              <p className="flex items-start gap-3"><MapPin size={17} aria-hidden="true" className="mt-1 shrink-0 text-[#f0a96d]"/><span>Salta Capital<br/>Provincia de Salta, Argentina</span></p>
              <a href="tel:+543874001234" className="flex items-center gap-3 rounded-sm transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]"><Phone size={17} aria-hidden="true" className="shrink-0 text-[#f0a96d]"/>+54 387 400-1234</a>
              <a href="mailto:reservas@hotelalejandro.com" className="flex items-center gap-3 break-all rounded-sm transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]"><Mail size={17} aria-hidden="true" className="shrink-0 text-[#f0a96d]"/>reservas@hotelalejandro.com</a>
            </div>
            <p className="mt-4 pl-8 text-sm leading-5 text-white/70">Consultá disponibilidad para planificar tu estadía.</p>
          </div>
          <div>
            <h2 className="font-serif text-xl uppercase tracking-wide">Tu estadía</h2>
            <nav aria-label="Navegación del hotel" className="mt-6 flex flex-col items-start gap-4 text-sm text-white/80">
              <Link href="/web#disponibilidad" className="rounded-sm transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Buscar habitaciones</Link>
              <Link href="/web/consulta" className="rounded-sm transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Consultar una reserva</Link>
              <Link href="/web#habitaciones" className="rounded-sm transition hover:text-[#ffd19b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Habitaciones y suites</Link>
            </nav>
          </div>
        </section>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <p>© Hotel Alejandro I · Salta Capital, Argentina</p>
          <Link href="/web" className="inline-flex items-center gap-2 rounded-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5bd76]">Volver al inicio <ArrowDown size={14} className="rotate-180" aria-hidden="true"/></Link>
        </div>
      </div>
    </footer>
  </main>;
}
