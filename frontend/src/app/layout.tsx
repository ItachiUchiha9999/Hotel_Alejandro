import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hotel Alejandro I — Gestión de Stock",
  description: "Sistema de Gestión Integral Hotelera (SIGH). Salta, Argentina.",
};

/**
 * Layout raíz. Delega toda la estructura visual en AppShell, que es el que
 * decide si mostrar el chrome de la aplicación o la pantalla limpia del login.
 *
 * Antes este archivo renderizaba un SliderBar propio con su topbar, y el
 * AppShell / Header / Sidebar del sistema de diseño nunca se usaba: quedaba
 * como código muerto. Por eso el login aparecía con el menú alrededor y los
 * enlaces del menú llevaban a rutas que no existían.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
