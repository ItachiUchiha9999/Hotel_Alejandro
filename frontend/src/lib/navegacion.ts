/**
 * Mapa de navegación del sistema. Es la ÚNICA fuente de verdad del menú:
 * si una pantalla no está acá, no existe para el usuario.
 *
 * Las rutas de acá tienen que coincidir con las carpetas de src/app.
 * (El menú anterior apuntaba a /deposits, /articles y /reports, que nunca
 * existieron como páginas: todos esos enlaces daban 404.)
 */

export interface ItemNavegacion {
  nombre: string;
  ruta: string;
  hijos?: ItemNavegacion[];
}

export const MODULOS: ItemNavegacion[] = [
  { nombre: "Inicio", ruta: "/" },
  { nombre: "Artículos", ruta: "/articulos" },
  {
    nombre: "Stock",
    ruta: "/stock",
    hijos: [
      { nombre: "Stock por depósito", ruta: "/stock" },
      { nombre: "Saldo consolidado", ruta: "/stock/saldo" },
      { nombre: "Depósitos", ruta: "/stock/depositos" },
      { nombre: "Registrar movimiento", ruta: "/stock/movements/new" },
      { nombre: "Tipos de movimiento", ruta: "/stock/tipos-movimiento" },
      { nombre: "Transferencias", ruta: "/stock/transfers" },
      { nombre: "Historial", ruta: "/stock/historial" },
    ],
  },
];
