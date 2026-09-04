/**
 * Mapa de navegación del sistema. Es la ÚNICA fuente de verdad del menú:
 * si una pantalla no está acá, no existe para el usuario.
 *
 * Las rutas de acá tienen que coincidir con las carpetas de src/app.
 * (El menú anterior apuntaba a /deposits, /articles y /reports, que nunca
 * existieron como páginas: todos esos enlaces daban 404.)
 *
 * "Reportes" agrupa Saldo consolidado e Historial como acceso directo,
 * además de seguir estando disponibles dentro de "Stock" (mismas rutas,
 * dos puntos de entrada). Pendiente: ocultar este ítem para roles
 * distintos de ADMINISTRADOR una vez esté el login real conectado a roles.
 *
 * Los ítems con hijos se renderizan como desplegable, no como enlace, así que
 * su `ruta` funciona solo como agrupador: /proveedores y /reportes no
 * necesitan tener una página propia.
 */

export interface ItemNavegacion {
  nombre: string;
  ruta: string;
  hijos?: ItemNavegacion[];
}

export const MODULOS: ItemNavegacion[] = [
  { nombre: "Inicio", ruta: "/" },
  { nombre: "Artículos", ruta: "/articulos" },
  { nombre: "Categorías", ruta: "/categorias" },

  {
    nombre: "Stock",
    ruta: "/stock",
    hijos: [
      { nombre: "Stock por depósito", ruta: "/stock" },
      { nombre: "Depósitos", ruta: "/stock/depositos" },
      { nombre: "Tipos de movimiento", ruta: "/stock/tipos-movimiento" },
      { nombre: "Transferencias", ruta: "/stock/transfers" },
    ],
  },

  {
    nombre: "Proveedores",
    ruta: "/proveedores",
    hijos: [
      { nombre: "Comprobantes", ruta: "/proveedores/comprobantes" },
      //{ nombre: "Registrar comprobante", ruta: "/proveedores/comprobantes/nuevo" },
    ],
  },

  {
    nombre: "Reportes",
    ruta: "/reportes",
    hijos: [
      { nombre: "Saldo consolidado", ruta: "/stock/saldo" },
      { nombre: "Historial", ruta: "/stock/historial" },
    ],
  },
];