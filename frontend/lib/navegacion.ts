/**
 * Mapa de navegación del sistema.
 * Para agregar una pantalla, sumá una entrada acá y creá la carpeta
 * correspondiente en app/. No hace falta tocar el Sidebar.
 */

export interface ItemNav {
  nombre: string;
  ruta: string;
  hijos?: ItemNav[];
}

export const MODULOS: ItemNav[] = [
  { nombre: "Reservas", ruta: "/reservas" },
  { nombre: "Habitaciones", ruta: "/habitaciones" },
  { nombre: "Clientes", ruta: "/clientes" },
  {
    nombre: "Stock e insumos",
    ruta: "/stock",
    hijos: [
      { nombre: "Depósitos", ruta: "/stock/depositos" },            // STK-01
      { nombre: "Artículos", ruta: "/stock/articulos" },            // STK-02
      { nombre: "Existencias", ruta: "/stock/existencias" },        // STK-03
      { nombre: "Tipos de movimiento", ruta: "/stock/tipos-movimiento" }, // STK-04
      { nombre: "Movimientos", ruta: "/stock/movimientos" },        // STK-05
      { nombre: "Transferencias", ruta: "/stock/transferencias" },  // STK-06
      { nombre: "Historial", ruta: "/stock/historial" },            // STK-07
    ],
  },
  { nombre: "Cobros", ruta: "/cobros" },
  { nombre: "Restaurante", ruta: "/restaurante" },
  { nombre: "Dashboard", ruta: "/dashboard" },
];
