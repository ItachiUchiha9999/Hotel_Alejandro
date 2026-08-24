import type { Config } from "tailwindcss";

/**
 * Configuración única del sistema. Nadie define colores ni fuentes
 * sueltas en sus componentes: todo sale de acá.
 * Regla del equipo: si necesitás un color nuevo, se agrega en este archivo
 * y se avisa al grupo. Nada de hexadecimales sueltos en el JSX.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Identidad del hotel */
        carbon: {
          DEFAULT: "#26333B", // sidebar, textos de máxima jerarquía
          dark: "#1A242B",    // header
          light: "#33434D",   // separadores sobre fondo oscuro
        },
        gold: {
          DEFAULT: "#CBA45C", // botón primario, item activo, iconografía
          dark: "#B08D48",    // hover del botón primario
          light: "#E3CB99",
        },
        bone: {
          DEFAULT: "#F4EFE4", // fondo del área de trabajo
          dark: "#E9E2D2",
        },
        line: "#E3DDD0",      // bordes de cards, tablas e inputs

        /* Estados (no son de marca: se usan sólo para feedback) */
        success: "#3F7A5E",
        danger: "#B3453C",
        warning: "#C08A34",
        info: "#3D6B87",
      },
      fontFamily: {
        // Títulos, marca y encabezados de sección
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
        // Interfaz: labels, tablas, menús, datos
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      /* Valores de transparencia extra usados en el layout oscuro
         (bg-white/8, text-bone/55, etc.). Sin esto Tailwind los ignora. */
      opacity: {
        2: "0.02",
        8: "0.08",
        15: "0.15",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      borderRadius: {
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(38, 51, 59, 0.04), 0 8px 24px -12px rgba(38, 51, 59, 0.12)",
      },
      maxWidth: {
        workspace: "64rem", // ancho del área de trabajo (max-w-5xl)
      },
    },
  },
  plugins: [],
};

export default config;
