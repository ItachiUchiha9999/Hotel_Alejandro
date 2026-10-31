"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { inicioPorRol, type RolSistema } from "@/lib/permisos";
import { Hotel, Shield, Sparkles } from "lucide-react";

type RespuestaLogin = {
  token: string;
  usuario: { employees_id: number; rol: RolSistema; nombre: string; email: string };
};

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleLogin = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setError("");
    setCargando(true);
    try {
      const sesion = await api.post<RespuestaLogin>("/auth/login", { usuario, contrasena });
      localStorage.setItem("tokenSesion", sesion.token);
      localStorage.setItem("sesionIniciada", "true");
      localStorage.setItem("rolUsuario", sesion.usuario.rol);
      localStorage.setItem("employeeId", String(sesion.usuario.employees_id));
      localStorage.setItem("usuarioNombre", sesion.usuario.nombre);
      setContrasena("");
      router.replace(inicioPorRol(sesion.usuario.rol));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión. Verificá que el servidor esté disponible.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-neutral-50">
      {/* Subtle animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200" />

      {/* Two subtle gold gradient orbs - more restrained */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-gradient-to-br from-gold-200/25 to-gold-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-gold-100/30 to-gold-300/10 blur-3xl" />
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gold-100/10 blur-3xl" />
      </div>

      {/* Very subtle grain texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }} />

      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md px-4 animate-slide-up-slow">
        {/* Logo/Brand header */}
        <div className="mb-10 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-400/30">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 opacity-20 blur" />
              <Hotel className="w-7 h-7 text-neutral-900 relative z-10" aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="font-serif text-xs tracking-[6px] text-gold-600 uppercase">HOTEL</div>
              <h1 className="font-serif text-5xl font-bold text-carbon tracking-tight">ALEJANDRO I</h1>
            </div>
          </div>
          <p className="mt-3 text-xs uppercase tracking-[3px] text-neutral-500 flex items-center justify-center gap-2">
            <span className="w-16 h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
            Administración · Acceso por rol
            <span className="w-16 h-px bg-gradient-to-r from-gold-400 via-transparent to-transparent" />
          </p>
        </div>

        {/* Login form card - glass morphism */}
        <div className="glass rounded-2xl border border-neutral-200/50 shadow-2xl p-8 sm:p-10 animate-scale-in stagger-2">
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-center text-sm text-danger-700 animate-slide-down flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Username field */}
            <div>
              <label
                htmlFor="usuario"
                className="mb-2 block text-xs font-semibold tracking-wider text-neutral-700 flex items-center gap-1.5"
              >
                <span className="text-gold-600">›</span>
                USUARIO O CORREO
              </label>
              <div className="relative">
                <input
                  id="usuario"
                  name="usuario"
                  type="text"
                  autoComplete="username"
                  value={usuario}
                  onChange={(evento) => setUsuario(evento.target.value)}
                  placeholder="admin, gerente, stock, gobernanza o recepción"
                  className="input-base pl-10 pr-4 py-3.5 text-sm"
                  required
                  disabled={cargando}
                  aria-describedby="usuario-hint"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
              </div>
              <p id="usuario-hint" className="mt-1.5 text-xs text-neutral-400">También podés ingresar con el correo de tu usuario.</p>
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="contrasena"
                className="mb-2 block text-xs font-semibold tracking-wider text-neutral-700 flex items-center gap-1.5"
              >
                <span className="text-gold-600">›</span>
                CONTRASEÑA
              </label>
              <div className="relative">
                <input
                  id="contrasena"
                  name="contrasena"
                  type="password"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(evento) => setContrasena(evento.target.value)}
                  className="input-base pl-10 pr-4 py-3.5 text-sm"
                  required
                  disabled={cargando}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" aria-hidden="true">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={cargando}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 py-3.5 text-sm font-semibold tracking-wider text-neutral-900 shadow-lg shadow-gold-400/40 transition-all duration-200 hover:from-gold-500 hover:to-gold-700 hover:shadow-xl hover:shadow-gold-500/50 active:from-gold-600 active:to-gold-800 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50 disabled:hover:from-gold-400 disabled:hover:to-gold-600 disabled:hover:shadow-lg disabled:hover:shadow-gold-400/40 disabled:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Ingresando…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Ingresar
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="mt-8 text-center text-xs text-neutral-400">
            ¿Problemas para acceder? Contactá al administrador del sistema.
          </p>
        </div>

        {/* Version badge */}
        <p className="mt-6 text-center text-[10px] uppercase tracking-[2px] text-neutral-400">
          Hotel Alejandro I · Sistema de Gestión Hotelera
        </p>
      </div>
    </div>
  );
}