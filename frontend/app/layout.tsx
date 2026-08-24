import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

/* Tipografías de marca expuestas como variables CSS y consumidas
   desde tailwind.config.ts (font-serif / font-sans). */
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIGH · Hotel Alejandro I",
  description: "Sistema Integral de Gestión Hotelera — Hotel Alejandro I",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
