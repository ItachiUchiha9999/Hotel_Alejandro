"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { inicioPorRol, type RolSistema } from "@/lib/permisos";

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
    <div className="flex min-h-screen items-center justify-center bg-carbon p-4">
      <div className="w-full max-w-md rounded-lg bg-bone p-8 shadow-card sm:p-10">
        <div className="mb-10 text-center">
          <div className="mb-2 font-serif text-xs tracking-[5px] text-gold">HOTEL</div>
          <h1 className="font-serif text-4xl text-carbon">ALEJANDRO I</h1>
          <p className="mt-3 text-[10px] uppercase tracking-[2px] text-carbon/60">Administración · Acceso por rol</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {error && <div role="alert" className="rounded-md border border-danger bg-danger/10 p-3 text-center text-sm text-danger">{error}</div>}
          <div>
            <label htmlFor="usuario" className="mb-2 block text-xs font-semibold tracking-wide text-carbon/70">USUARIO O CORREO</label>
            <input id="usuario" name="usuario" type="text" autoComplete="username" value={usuario} onChange={(evento) => setUsuario(evento.target.value)} placeholder="admin, gerente, stock, gobernanza o recepción" className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm text-carbon focus:border-gold focus:outline-none" required />
            <p className="mt-1 text-xs text-carbon/55">También podés ingresar con el correo de tu usuario.</p>
          </div>
          <div>
            <label htmlFor="contrasena" className="mb-2 block text-xs font-semibold tracking-wide text-carbon/70">CONTRASEÑA</label>
            <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" value={contrasena} onChange={(evento) => setContrasena(evento.target.value)} className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm text-carbon focus:border-gold focus:outline-none" required />
          </div>
          <button type="submit" disabled={cargando} className="mt-2 w-full rounded-md bg-gold py-3 text-sm font-semibold tracking-wide text-carbon transition-colors hover:bg-gold-dark disabled:cursor-wait disabled:opacity-60">
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
