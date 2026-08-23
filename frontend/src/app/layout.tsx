import type { Metadata } from 'next';
import Sidebar from '../components/SliderBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hotel Alejandro I - Control de Stock',
  description: 'Sistema de Gestión de Inventario - Salta, Argentina',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 antialiased font-sans">
        <div className="flex h-screen overflow-hidden">
          {/* SIDEBAR DERECHO/IZQUIERDO */}
          <Sidebar />

          {/* CONTENIDOR PRINCIPAL */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* TOPBAR */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs bg-[#1b2631] text-[#c59b27] font-bold px-3 py-1 rounded-md tracking-wider border border-[#c59b27]/30 uppercase">
                  Hotel Alejandro I
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-sm font-medium text-slate-600">Módulo Stock</span>
              </div>

              {/* PERFIL USUARIO */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">Admin</p>
                  <p className="text-xs text-[#c59b27] font-medium">Administrador</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1b2631] text-[#c59b27] font-serif font-bold flex items-center justify-center border-2 border-[#c59b27] shadow-sm">
                  AD
                </div>
              </div>
            </header>

            {/* ÁREA DE CONTENIDO */}
            <main className="p-8 bg-slate-50 min-h-[calc(100vh-73px)]">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}