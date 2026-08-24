"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

 const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (usuario === "admin" && password === "1234") {
      localStorage.setItem("sesionIniciada", "true");
      
      // 👇 ESTA ES LA LÍNEA MÁGICA
      router.push("/"); 
      
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="min-h-screen bg-carbon flex items-center justify-center p-4">
      <div className="bg-bone w-full max-w-md rounded-lg shadow-card p-10">
        
        {/* Cabecera de la marca */}
        <div className="text-center mb-10">
          <div className="text-xs font-serif tracking-[5px] text-gold mb-2">HOTEL</div>
          <h1 className="text-4xl font-serif text-carbon">ALEJANDRO I</h1>
          <div className="text-[9px] font-sans tracking-[2px] text-carbon/50 mt-3 uppercase">
            Administracion
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          {error && (
            <div className="bg-danger/10 border border-danger text-danger text-sm p-3 rounded-md text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-sans tracking-[1.4px] text-carbon/60 mb-2 font-semibold">
              USUARIO
            </label>
            <input 
              type="text" 
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej: lfarfan"
              className="w-full px-4 py-2.5 border border-line rounded-md focus:outline-none focus:border-gold bg-white text-carbon text-sm transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-sans tracking-[1.4px] text-carbon/60 mb-2 font-semibold">
              CONTRASEÑA
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-line rounded-md focus:outline-none focus:border-gold bg-white text-carbon text-sm transition-colors"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full mt-2 bg-gold hover:bg-gold-dark text-carbon font-semibold py-3 rounded-md transition-colors text-sm tracking-wide"
          >
            Ingresar 
          </button>
        </form>

      </div>
    </div>
  );
}