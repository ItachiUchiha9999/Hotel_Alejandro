/**
 * Carga masiva de datos de demostración para SIGH — Hotel Alejandro I.
 *
 * Genera un set grande y coherente para que todos los módulos y gráficos
 * tengan información representativa:
 *
 *   · Tipos de habitación y habitaciones con numeración realista (pisos 1 a 5).
 *   · Tarifas por temporada (ALTA / GENERAL / BAJA / ESPECIAL) para todo el año.
 *   · Huéspedes, reservas, check-in, check-out, acompañantes, cobros y
 *     consumos de servicios de habitación distribuidos de enero a diciembre.
 *   · Pedidos web, retenciones de habitación y auditoría de cambios.
 *   · Inventario: categorías, artículos, depósitos, saldos y movimientos.
 *   · Proveedores, órdenes de compra, comprobantes, gastos, órdenes de pago,
 *     cuenta corriente y vínculos gasto ↔ orden de pago.
 *
 * Uso (desde backend/):
 *   node scripts/seed-demo-masivo.js            # carga los ejemplos
 *   node scripts/seed-demo-masivo.js --estado   # muestra el estado actual
 *
 * Es de una sola pasada: al terminar graba el parámetro
 * `DEMO_MASIVO_VERSION` y, si ya existe, no vuelve a cargar nada.
 * Para recargar desde cero conviene reinstalar la base en un esquema limpio
 * (`database/instalar.sql`) y volver a ejecutar este script.
 */

const crypto = require('node:crypto');
const prisma = require('../src/db/prisma');

const MARCA = 'DEMO MASIVO';
const CLAVE_MARCADOR = 'DEMO_MASIVO_VERSION';
const CLAVE_MARCADOR_FUTURAS = 'DEMO_MASIVO_FUTURAS';
const VERSION = '1';
const ZONA = 'America/Argentina/Buenos_Aires';

// ---------------------------------------------------------------------------
// Fechas y azar determinista
// ---------------------------------------------------------------------------

const DIA_MS = 86400000;

/** Fecha sin hora para columnas DATE, anclada a medianoche UTC. */
const fecha = (iso) => new Date(`${iso}T00:00:00.000Z`);

/** Instante con horario argentino para columnas TIMESTAMPTZ. */
const instante = (iso, hora = '10:00:00') => new Date(`${iso}T${hora}-03:00`);

const iso = (valor) => (valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor));

const sumarDias = (isoBase, dias) =>
  new Date(new Date(`${isoBase}T00:00:00.000Z`).getTime() + dias * DIA_MS).toISOString().slice(0, 10);

const restarDias = (isoBase, dias) => sumarDias(isoBase, -dias);

const diferenciaDias = (desdeISO, hastaISO) =>
  Math.round(
    (new Date(`${desdeISO}T00:00:00.000Z`) - new Date(`${hastaISO}T00:00:00.000Z`)) / DIA_MS,
  );

const diaSemana = (isoBase) => new Date(`${isoBase}T00:00:00.000Z`).getUTCDay();

const hoyArgentina = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

const HOY = hoyArgentina();
const ANIO = Number(HOY.slice(0, 4));

/** Generador pseudoaleatorio determinista (mulberry32). */
function crearRng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = crearRng(20261030);
const entero = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const elegir = (lista) => lista[Math.floor(rng() * lista.length)];
const azar = (probabilidad) => rng() < probabilidad;
const redondear = (numero, paso = 500) => Math.round(numero / paso) * paso;
const dinero = (numero) => Math.round(numero * 100) / 100;

function elegirPonderado(opciones) {
  const total = opciones.reduce((suma, [, peso]) => suma + peso, 0);
  let sorteo = rng() * total;
  for (const [valor, peso] of opciones) {
    sorteo -= peso;
    if (sorteo <= 0) return valor;
  }
  return opciones[0][0];
}

const horaAzar = (desde = 8, hasta = 21) =>
  `${String(entero(desde, hasta)).padStart(2, '0')}:${String(entero(0, 59)).padStart(2, '0')}:00`;

const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Dígito verificador de CUIT (11 dígitos: 2 de tipo + 8 de cuerpo + 1). */
function cuit(prefijo, cuerpo) {
  const base = `${prefijo}${cuerpo}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = base.split('').reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return `${prefijo}-${cuerpo}-${verificador}`;
}

// ---------------------------------------------------------------------------
// Datos base de la demostración
// ---------------------------------------------------------------------------

const TIPOS_HABITACION = [
  {
    nombre: 'SIMPLE', base: 55000, capacidad: 1, adultos: 1,
    camas: '1 cama individual', metros: 18, balcon: false, minibar: false,
    descripcion: 'Habitación individual con escritorio, wifi y baño privado.',
  },
  {
    nombre: 'DOBLE', base: 85000, capacidad: 2, adultos: 2,
    camas: '1 cama Queen o 2 individuales', metros: 26, balcon: false, minibar: true,
    descripcion: 'Habitación doble estándar con frigobar y aire acondicionado.',
  },
  {
    nombre: 'TRIPLE', base: 110000, capacidad: 3, adultos: 3,
    camas: '1 cama Queen + 1 individual', metros: 32, balcon: true, minibar: true,
    descripcion: 'Habitación triple con espacio de estar y balcón al cerro.',
  },
  {
    nombre: 'SUITE', base: 180000, capacidad: 4, adultos: 3,
    camas: '1 cama King + sofá cama', metros: 55, balcon: true, minibar: true,
    descripcion: 'Suite con sala de estar separada, balcón y vista panorámica.',
  },
  {
    nombre: 'DOBLE SUPERIOR', base: 105000, capacidad: 2, adultos: 2,
    camas: '1 cama King', metros: 30, balcon: true, minibar: true,
    descripcion: 'Doble superior con cama King, ropa de cama premium y balcón.',
  },
  {
    nombre: 'DOBLE TWIN', base: 90000, capacidad: 2, adultos: 2,
    camas: '2 camas individuales', metros: 27, balcon: false, minibar: true,
    descripcion: 'Habitación twin ideal para colegas o amigos que viajan juntos.',
  },
  {
    nombre: 'CUADRUPLE FAMILIAR', base: 145000, capacidad: 4, adultos: 4,
    camas: '1 cama Queen + 2 individuales', metros: 42, balcon: true, minibar: true,
    descripcion: 'Habitación familiar amplia con dos ambientes y baño completo.',
  },
  {
    nombre: 'SUITE JUNIOR', base: 155000, capacidad: 3, adultos: 3,
    camas: '1 cama King + sofá cama', metros: 45, balcon: true, minibar: true,
    descripcion: 'Junior suite con estar integrado, cafetera y vistas al valle.',
  },
  {
    nombre: 'SUITE PRESIDENCIAL', base: 280000, capacidad: 4, adultos: 4,
    camas: '1 cama King + sala de estar', metros: 80, balcon: true, minibar: true,
    descripcion: 'Suite presidencial con comedor, jacuzzi y atención preferencial.',
  },
];

const HABITACIONES_NUEVAS = [
  // Piso 1
  ['106', 'DOBLE SUPERIOR', 1, 'Ciudad', 'Cerca del jardín interno'],
  ['107', 'DOBLE SUPERIOR', 1, 'Ciudad', null],
  ['108', 'DOBLE TWIN', 1, 'Patio interno', null],
  ['109', 'CUADRUPLE FAMILIAR', 1, 'Jardín', 'Adaptada para familias'],
  ['110', 'SIMPLE', 1, 'Patio interno', null],
  // Piso 2
  ['205', 'DOBLE SUPERIOR', 2, 'Cerro San Bernardo', null],
  ['206', 'DOBLE SUPERIOR', 2, 'Cerro San Bernardo', null],
  ['207', 'DOBLE TWIN', 2, 'Ciudad', null],
  ['208', 'DOBLE', 2, 'Ciudad', null],
  ['209', 'DOBLE', 2, 'Patio interno', null],
  ['210', 'TRIPLE', 2, 'Cerro San Bernardo', null],
  // Piso 3
  ['302', 'DOBLE SUPERIOR', 3, 'Panorámica', null],
  ['303', 'DOBLE SUPERIOR', 3, 'Panorámica', null],
  ['304', 'DOBLE TWIN', 3, 'Cerro San Bernardo', null],
  ['305', 'DOBLE TWIN', 3, 'Cerro San Bernardo', null],
  ['306', 'TRIPLE', 3, 'Ciudad', null],
  ['307', 'CUADRUPLE FAMILIAR', 3, 'Jardín', null],
  ['308', 'DOBLE', 3, 'Ciudad', null],
  ['309', 'DOBLE', 3, 'Panorámica', null],
  ['310', 'SIMPLE', 3, 'Patio interno', null],
  // Piso 4
  ['407', 'SUITE JUNIOR', 4, 'Panorámica', null],
  ['408', 'SUITE JUNIOR', 4, 'Panorámica', null],
  ['409', 'SUITE', 4, 'Cerro San Bernardo', null],
  ['410', 'SUITE PRESIDENCIAL', 4, 'Panorámica', 'Piso ejecutivo'],
  // Piso 5
  ['501', 'SUITE JUNIOR', 5, 'Panorámica', null],
  ['502', 'SUITE JUNIOR', 5, 'Panorámica', null],
  ['503', 'DOBLE SUPERIOR', 5, 'Panorámica', null],
  ['504', 'DOBLE SUPERIOR', 5, 'Panorámica', null],
  ['505', 'DOBLE TWIN', 5, 'Ciudad', null],
  ['506', 'CUADRUPLE FAMILIAR', 5, 'Panorámica', null],
  ['507', 'SUITE', 5, 'Panorámica', null],
  ['508', 'SUITE PRESIDENCIAL', 5, 'Panorámica', 'Último piso'],
  ['509', 'DOBLE', 5, 'Ciudad', null],
  ['510', 'SIMPLE', 5, 'Patio interno', null],
];

const NOMBRES_M = [
  'Juan', 'José', 'Luis', 'Carlos', 'Martín', 'Diego', 'Pablo', 'Santiago', 'Matías', 'Nicolás',
  'Federico', 'Gastón', 'Emiliano', 'Ramiro', 'Tomás', 'Agustín', 'Facundo', 'Leandro', 'Gonzalo',
  'Hernán', 'Julián', 'Mariano', 'Rodrigo', 'Sebastián', 'Alejandro', 'Bruno', 'Ezequiel', 'Ignacio',
  'Joaquín', 'Lautaro', 'Franco', 'Maximiliano', 'Cristian', 'Damián', 'Enzo', 'Iván',
];
const NOMBRES_F = [
  'María', 'Ana', 'Laura', 'Carla', 'Sofía', 'Valentina', 'Lucía', 'Camila', 'Florencia', 'Julieta',
  'Agustina', 'Martina', 'Paula', 'Daniela', 'Verónica', 'Silvina', 'Gabriela', 'Rocío', 'Micaela',
  'Bárbara', 'Carolina', 'Elena', 'Inés', 'Natalia', 'Noelia', 'Patricia', 'Romina', 'Sabrina',
  'Tamara', 'Victoria', 'Alejandra', 'Cecilia', 'Emilia', 'Josefina', 'Lorena', 'Renata',
];
const APELLIDOS = [
  'Gómez', 'Pérez', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Díaz',
  'Sosa', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera',
  'Aguirre', 'Giménez', 'Molina', 'Silva', 'Rojas', 'Vargas', 'Castro', 'Ortiz', 'Núñez', 'Luna',
  'Cabrera', 'Ríos', 'Morales', 'Suárez', 'Paz', 'Vega', 'Campos', 'Godoy', 'Coronel', 'Figueroa',
  'Arias', 'Maldonado', 'Cáceres', 'Villalba', 'Alderete', 'Chávez', 'Ibáñez', 'Peralta',
];
const CALLES = [
  'Av. Belgrano', 'Caseros', 'Mitre', 'Sarmiento', 'Zuviría', 'Alvarado', 'Buenos Aires',
  'San Martín', 'Córdoba', 'Entre Ríos', 'Balcarce', 'Pueyrredón', 'Av. del Bicentenario',
];
const CIUDADES = ['Salta', 'San Lorenzo', 'Cerrillos', 'Rosario de Lerma', 'Cafayate', 'Metán'];
const EXTRANJEROS = [
  { pais: 'Chile', prefijo: 'CL' },
  { pais: 'Brasil', prefijo: 'BR' },
  { pais: 'Uruguay', prefijo: 'UY' },
  { pais: 'España', prefijo: 'ES' },
  { pais: 'Estados Unidos', prefijo: 'US' },
  { pais: 'Bolivia', prefijo: 'BO' },
  { pais: 'Paraguay', prefijo: 'PY' },
  { pais: 'Perú', prefijo: 'PE' },
];

const PROVEEDORES_NUEVOS = [
  {
    cuerpo: '71234567', prefijo: '30', legal: 'Lavandería Industrial Salta S.R.L.',
    trade: 'Lavandería del Valle', email: 'compras@lavanderiadelvalle.com.ar',
    telefono: '+54 387 421-7788', direccion: 'Ruta 68 Km 3, Salta', impuesto: 1,
  },
  {
    cuerpo: '72345678', prefijo: '30', legal: 'Mantenimiento Edilicio Andino S.A.',
    trade: 'Edilicio Andino', email: 'administracion@edilicioandino.com',
    telefono: '+54 387 431-2200', direccion: 'Av. Chile 1450, Salta', impuesto: 1,
  },
  {
    cuerpo: '73456789', prefijo: '30', legal: 'Tecnología Hotelera NOA S.R.L.',
    trade: 'TecnoHotel NOA', email: 'ventas@tecnohotelnoa.com.ar',
    telefono: '+54 387 445-9080', direccion: 'Balcarce 780, Salta', impuesto: 1,
  },
  {
    cuerpo: '74567890', prefijo: '30', legal: 'Distribuidora de Bebidas del Valle S.A.',
    trade: 'Bebidas del Valle', email: 'pedidos@bebidasdelvalle.com.ar',
    telefono: '+54 387 456-3311', direccion: 'Av. Paraguay 2100, Salta', impuesto: 1,
  },
  {
    cuerpo: '75678901', prefijo: '30', legal: 'Papelera y Descartables Salta S.R.L.',
    trade: 'Papelera Salta', email: 'contacto@papelerasalt.com.ar',
    telefono: '+54 387 467-5522', direccion: 'Zuviría 990, Salta', impuesto: 2,
  },
  {
    cuerpo: '76789012', prefijo: '30', legal: 'Frigorífico Los Andes S.A.',
    trade: 'Frigorífico Los Andes', email: 'cuentas@frigorificolosandes.com',
    telefono: '+54 387 478-6644', direccion: 'Ruta 9 Km 12, Salta', impuesto: 1,
  },
];

const ARTICULOS_NUEVOS = [
  { codigo: 'AME-002', nombre: 'Acondicionador 30 ml', categoria: 3, unidad: 'UNIDAD', minimo: 40 },
  { codigo: 'AME-003', nombre: 'Gorro de ducha descartable', categoria: 3, unidad: 'UNIDAD', minimo: 60 },
  { codigo: 'AME-004', nombre: 'Set de amenities premium', categoria: 3, unidad: 'CAJA', minimo: 15 },
  { codigo: 'LIM-002', nombre: 'Lavandina concentrada 5 L', categoria: 2, unidad: 'BIDON', minimo: 10 },
  { codigo: 'LIM-003', nombre: 'Bolsas de residuos 60x80', categoria: 2, unidad: 'PAQUETE', minimo: 20 },
  { codigo: 'BLA-003', nombre: 'Almohada fibra hueca', categoria: 1, unidad: 'UNIDAD', minimo: 20 },
  { codigo: 'FRI-003', nombre: 'Gaseosa cola 1.5 L', categoria: 4, unidad: 'UNIDAD', minimo: 60 },
  { codigo: 'FRI-004', nombre: 'Cerveza artesanal 500 ml', categoria: 4, unidad: 'UNIDAD', minimo: 48 },
  { codigo: 'FRI-005', nombre: 'Chocolate artesanal 80 g', categoria: 4, unidad: 'UNIDAD', minimo: 40 },
  { codigo: 'MAN-001', nombre: 'Kit de herramientas básico', categoria: 5, unidad: 'UNIDAD', minimo: 2 },
  { codigo: 'MAN-002', nombre: 'Pintura látex interior 20 L', categoria: 5, unidad: 'BIDON', minimo: 4 },
];

const SERVICIOS_NUEVOS = [
  { nombre: 'Minibar: vino Malbec 750 ml', categoria: 'MINIBAR', precio: 18000, articulo: 'FRI-002', deposito: 4, descripcion: 'Botella de vino Malbec reserva de bodega salteña.' },
  { nombre: 'Minibar: cerveza artesanal 500 ml', categoria: 'MINIBAR', precio: 6500, articulo: 'FRI-004', deposito: 4, descripcion: 'Cerveza artesanal del valle, bien fría.' },
  { nombre: 'Minibar: chocolate artesanal 80 g', categoria: 'MINIBAR', precio: 4500, articulo: 'FRI-005', deposito: 4, descripcion: 'Chocolate con nueces de la zona.' },
  { nombre: 'Desayuno a la habitación', categoria: 'GASTRONOMIA', precio: 9500, descripcion: 'Desayuno continental servido en la habitación.' },
  { nombre: 'Late check-out hasta 15 h', categoria: 'OTROS', precio: 12000, descripcion: 'Extensión de la salida hasta las 15:00.' },
  { nombre: 'Cuna adicional', categoria: 'OTROS', precio: 7000, descripcion: 'Cuna o cama suplementaria para menores de 3 años.' },
  { nombre: 'Servicio de spa (60 min)', categoria: 'OTROS', precio: 25000, descripcion: 'Masaje descontracturante en el spa del hotel.' },
];

// ---------------------------------------------------------------------------
// Utilidades de base de datos
// ---------------------------------------------------------------------------

const mapas = {
  tipos: new Map(), // nombre -> registro room_type
  habitaciones: [], // habitaciones de la demo
  huespedes: [],
  servicios: [],
  articulos: new Map(), // código -> registro
  proveedores: new Map(), // CUIT -> supplier_id
  tiposMovimiento: new Map(), // nombre -> registro
  metodosPago: [],
  tiposComprobante: new Map(), // nombre -> registro
  empleados: {},
  tarifas: new Map(), // room_type_id -> lista de tarifas ordenadas
  contadores: { reserva: 0, pago: 0, cargo: 0, ordenPago: 0, movimiento: 0 },
};

async function asegurarFilaStock(tx, articleId, depositId) {
  return tx.articles_deposit_stock.upsert({
    where: { article_id_deposit_id: { article_id: articleId, deposit_id: depositId } },
    update: {},
    create: { article_id: articleId, deposit_id: depositId, stock_amount: 0 },
  });
}

async function sumarStock(tx, articleId, depositId, cantidad) {
  const fila = await asegurarFilaStock(tx, articleId, depositId);
  return tx.articles_deposit_stock.update({
    where: { stock_id: fila.stock_id },
    data: { stock_amount: { increment: cantidad } },
  });
}

async function restarStock(tx, articleId, depositId, cantidad) {
  const fila = await asegurarFilaStock(tx, articleId, depositId);
  const disponible = Number(fila.stock_amount);
  if (disponible < cantidad) return null;
  return tx.articles_deposit_stock.update({
    where: { stock_id: fila.stock_id },
    data: { stock_amount: { decrement: cantidad } },
  });
}

/**
 * Registra un movimiento de stock y actualiza los saldos por depósito.
 * Devuelve null si no queda nada por mover.
 */
async function crearMovimiento(tx, datos) {
  const tipo = mapas.tiposMovimiento.get(datos.tipo);
  if (!tipo) throw new Error(`Falta el tipo de movimiento ${datos.tipo}.`);

  const detalles = [];
  for (const item of datos.items) {
    let cantidad = item.cantidad;
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

    let filaOrigen = null;
    if (datos.origen) {
      filaOrigen = await asegurarFilaStock(tx, item.articulo, datos.origen);
      cantidad = Math.min(cantidad, Number(filaOrigen.stock_amount));
      if (cantidad <= 0) continue;
      await tx.articles_deposit_stock.update({
        where: { stock_id: filaOrigen.stock_id },
        data: { stock_amount: { decrement: cantidad } },
      });
      detalles.push({ stock_id: filaOrigen.stock_id, amount: cantidad });
    }
    if (datos.destino) {
      const filaDestino = await sumarStock(tx, item.articulo, datos.destino, cantidad);
      detalles.push({ stock_id: filaDestino.stock_id, amount: cantidad });
    }
  }

  if (!detalles.length) return null;

  mapas.contadores.movimiento += 1;
  const movimiento = await tx.stock_movement.create({
    data: {
      movement_type_id: tipo.movement_type_id,
      deposit_origin_id: datos.origen ?? null,
      deposit_destination_id: datos.destino ?? null,
      employees_id: datos.empleado,
      supplier_id: datos.proveedor ?? null,
      observations: `${MARCA}: ${datos.observaciones}`,
      transaction_date: instante(datos.fecha, datos.hora ?? '10:00:00'),
    },
  });

  await tx.movement_stock_detail.createMany({
    data: detalles.map((detalle) => ({ ...detalle, stock_movement_id: movimiento.stock_movement_id })),
  });

  return movimiento;
}

// ---------------------------------------------------------------------------
// 1. Empleados y catálogos
// ---------------------------------------------------------------------------

async function prepararEmpleados(tx) {
  const roles = await tx.roles.findMany();
  const porNombre = new Map(roles.map((rol) => [rol.rol_name, rol]));
  const requeridos = ['ADMINISTRADOR', 'ENCARGADO_STOCK', 'GOBERNANZA', 'RECEPCION', 'GERENTE'];
  const faltantes = requeridos.filter((nombre) => !porNombre.has(nombre));
  if (faltantes.length) throw new Error(`Faltan roles en la base: ${faltantes.join(', ')}.`);

  const adicionales = [
    { nombre: 'Matías', apellido: 'Funes', email: 'mfunes@hotelalejandro.com', rol: 'RECEPCION', telefono: '+54 387 411-2233' },
    { nombre: 'Andrea', apellido: 'Cruz', email: 'acruz@hotelalejandro.com', rol: 'GOBERNANZA', telefono: '+54 387 422-3344' },
    { nombre: 'Pablo', apellido: 'Quinteros', email: 'pquinteros@hotelalejandro.com', rol: 'GOBERNANZA', telefono: '+54 387 433-4455' },
    { nombre: 'Natalia', apellido: 'Vega', email: 'nvega@hotelalejandro.com', rol: 'RECEPCION', telefono: '+54 387 444-5566' },
    { nombre: 'Gustavo', apellido: 'Medina', email: 'gmedina@hotelalejandro.com', rol: 'GERENTE', telefono: '+54 387 455-6677' },
  ];

  for (const persona of adicionales) {
    await tx.employees.upsert({
      where: { employees_email: persona.email },
      update: {},
      create: {
        rol_id: porNombre.get(persona.rol).rol_id,
        employees_name: persona.nombre,
        employees_lastname: persona.apellido,
        employees_email: persona.email,
        employees_phone: persona.telefono,
      },
    });
  }

  const todos = await tx.employees.findMany({ orderBy: { employees_id: 'asc' } });
  const porRol = (nombre) => todos.filter((e) => e.rol_id === porNombre.get(nombre).rol_id);

  mapas.empleados = {
    admin: todos.find((e) => e.employees_email === 'cgomez@hotelalejandro.com') ?? todos[0],
    stock: todos.find((e) => e.employees_email === 'mlopez@hotelalejandro.com') ?? todos[0],
    gobernanza: todos.find((e) => e.employees_email === 'smartinez@hotelalejandro.com') ?? todos[0],
    recepcion: porRol('RECEPCION'),
    gerencia: porRol('GERENTE'),
    todos,
  };

  if (!mapas.empleados.recepcion.length) throw new Error('No hay empleados de recepción para asignar.');
}

async function prepararCatalogos(tx) {
  mapas.metodosPago = await tx.payment_method.findMany({ where: { active: true }, orderBy: { payment_method_id: 'asc' } });
  if (!mapas.metodosPago.length) throw new Error('No hay formas de pago activas.');

  const tiposComprobante = await tx.voucher_type.findMany({ where: { active: true } });
  mapas.tiposComprobante = new Map(tiposComprobante.map((tipo) => [tipo.voucher_type, tipo]));

  const movimientos = await tx.movement_type.findMany({ where: { active: true } });
  mapas.tiposMovimiento = new Map(movimientos.map((tipo) => [tipo.movement_type, tipo]));

  for (const nombre of ['INGRESO', 'EGRESO', 'TRANSFERENCIA', 'CONSUMO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO']) {
    if (!mapas.tiposMovimiento.has(nombre)) throw new Error(`Falta el tipo de movimiento ${nombre}.`);
  }
}

// ---------------------------------------------------------------------------
// 2. Proveedores
// ---------------------------------------------------------------------------

async function prepararProveedores(tx) {
  const existentes = await tx.suppliers.findMany();
  const porCuit = new Map(existentes.map((proveedor) => [proveedor.supplier_cuit, proveedor]));

  // Condición fiscal coherente para los proveedores que ya venían cargados.
  const condiciones = new Map([
    ['30-71123456-8', 1], ['30-65498732-1', 2], ['30-58963214-5', 1],
    ['30-11122233-4', 1], ['30-99887766-2', 1],
  ]);
  for (const [cuitProveedor, condicion] of condiciones) {
    const proveedor = porCuit.get(cuitProveedor);
    if (proveedor && proveedor.tax_condition_id !== condicion) {
      await tx.suppliers.update({
        where: { supplier_id: proveedor.supplier_id },
        data: { tax_condition_id: condicion },
      });
    }
  }

  for (const nuevo of PROVEEDORES_NUEVOS) {
    const numero = cuit(nuevo.prefijo, nuevo.cuerpo);
    const creado = await tx.suppliers.upsert({
      where: { supplier_cuit: numero },
      update: {},
      create: {
        supplier_legal_name: nuevo.legal,
        supplier_trade_name: nuevo.trade,
        supplier_cuit: numero,
        supplier_email: nuevo.email,
        supplier_phone: nuevo.telefono,
        supplier_address: nuevo.direccion,
        tax_condition_id: nuevo.impuesto,
      },
    });
    mapas.proveedores.set(numero, creado.supplier_id);
  }

  const todos = await tx.suppliers.findMany({ where: { supplier_state: true }, orderBy: { supplier_id: 'asc' } });
  for (const proveedor of todos) mapas.proveedores.set(proveedor.supplier_cuit, proveedor.supplier_id);
  return todos;
}

// ---------------------------------------------------------------------------
// 3. Tipos de habitación, tarifas y habitaciones
// ---------------------------------------------------------------------------

async function prepararTiposHabitacion(tx) {
  // El tipo original "SIMPLE BARATO" pasa a llamarse simplemente "SIMPLE".
  const barato = await tx.room_type.findUnique({ where: { room_type_name: 'SIMPLE BARATO' } });
  const simple = await tx.room_type.findUnique({ where: { room_type_name: 'SIMPLE' } });
  if (barato && !simple) {
    await tx.room_type.update({
      where: { room_type_id: barato.room_type_id },
      data: { room_type_name: 'SIMPLE' },
    });
  }

  for (const definicion of TIPOS_HABITACION) {
    const existente = await tx.room_type.findUnique({ where: { room_type_name: definicion.nombre } });
    const datos = {
      room_type_description: definicion.descripcion,
      room_type_max_capacity: definicion.capacidad,
      max_adults: definicion.adultos,
      bed_setup: definicion.camas,
      square_meters: definicion.metros,
      has_balcony: definicion.balcon,
      has_minibar: definicion.minibar,
      has_air_conditioning: true,
      room_type_state: true,
    };
    const tipo = existente
      ? await tx.room_type.update({ where: { room_type_id: existente.room_type_id }, data: datos })
      : await tx.room_type.create({ data: { room_type_name: definicion.nombre, ...datos } });
    mapas.tipos.set(definicion.nombre, { ...tipo, base: definicion.base, nuevo: !existente });
  }
}

const TEMPORADAS = () => [
  [`${ANIO}-01-01`, `${ANIO}-03-01`, 'ALTA', 1.35],
  [`${ANIO}-03-01`, `${ANIO}-04-01`, 'BAJA', 0.85],
  [`${ANIO}-04-01`, `${ANIO}-04-07`, 'ESPECIAL', 1.25],
  [`${ANIO}-04-07`, `${ANIO}-06-01`, 'BAJA', 0.85],
  [`${ANIO}-06-01`, `${ANIO}-07-01`, 'GENERAL', 1.0],
  [`${ANIO}-07-01`, `${ANIO}-08-01`, 'ALTA', 1.3],
  [`${ANIO}-08-01`, `${ANIO}-11-01`, 'GENERAL', 1.0],
  [`${ANIO}-11-01`, `${ANIO + 1}-03-01`, 'ALTA', 1.4],
];

const FACTOR_TEMPORADA = { ALTA: 1.3, GENERAL: 1.0, BAJA: 0.85, ESPECIAL: 1.2 };

async function prepararTarifas(tx) {
  const empleado = mapas.empleados.gerencia[0] ?? mapas.empleados.admin;
  const corte = `${ANIO}-09-17`;
  const segmentos = TEMPORADAS();

  for (const [nombre, tipo] of mapas.tipos) {
    const existentes = await tx.room_type_rate.findMany({
      where: { room_type_id: tipo.room_type_id },
      orderBy: { valid_from: 'asc' },
    });

    if (!existentes.length) {
      // Tipo nuevo: serie completa de temporadas.
      for (const [desde, hasta, temporada, factor] of segmentos) {
        await tx.room_type_rate.create({
          data: {
            room_type_id: tipo.room_type_id,
            base_price: redondear(tipo.base * factor),
            currency: 'ARS',
            valid_from: fecha(desde),
            valid_to: fecha(hasta),
            season_name: temporada,
            reason: `${MARCA}: temporada ${temporada.toLowerCase()} ${ANIO}`,
            employees_id: empleado.employees_id,
          },
        });
      }
      continue;
    }

    // Tarifas ya existentes: se actualiza el precio base según la temporada.
    for (const tarifa of existentes) {
      const objetivo = redondear(tipo.base * (FACTOR_TEMPORADA[tarifa.season_name] ?? 1));
      if (Number(tarifa.base_price) !== objetivo) {
        await tx.room_type_rate.update({
          where: { rate_id: tarifa.rate_id },
          data: {
            base_price: objetivo,
            reason: `${MARCA}: actualización tarifaria ${ANIO}`,
            employees_id: empleado.employees_id,
          },
        });
      }
    }

    // Serie histórica hasta el comienzo de las tarifas que ya existían.
    const hayHistoricas = existentes.some((tarifa) => iso(tarifa.valid_from) < corte);
    if (!hayHistoricas) {
      for (const [desde, hasta, temporada, factor] of segmentos) {
        if (desde >= corte) break;
        const fin = hasta > corte ? corte : hasta;
        if (fin <= desde) continue;
        await tx.room_type_rate.create({
          data: {
            room_type_id: tipo.room_type_id,
            base_price: redondear(tipo.base * factor),
            currency: 'ARS',
            valid_from: fecha(desde),
            valid_to: fecha(fin),
            season_name: temporada,
            reason: `${MARCA}: temporada ${temporada.toLowerCase()} ${ANIO}`,
            employees_id: empleado.employees_id,
          },
        });
      }
    }

    // Temporada alta de fin de año, si todavía no está definida.
    const novIso = `${ANIO}-11-01`;
    const hayNoviembre = existentes.some((tarifa) => iso(tarifa.valid_from) === novIso);
    if (!hayNoviembre) {
      const abierta = await tx.room_type_rate.findFirst({
        where: { room_type_id: tipo.room_type_id, valid_to: null, valid_from: { lt: fecha(novIso) } },
        orderBy: { valid_from: 'desc' },
      });
      if (abierta) {
        await tx.room_type_rate.update({
          where: { rate_id: abierta.rate_id },
          data: { valid_to: fecha(novIso) },
        });
      }
      await tx.room_type_rate.create({
        data: {
          room_type_id: tipo.room_type_id,
          base_price: redondear(tipo.base * 1.4),
          currency: 'ARS',
          valid_from: fecha(novIso),
          valid_to: fecha(`${ANIO + 1}-03-01`),
          season_name: 'ALTA',
          reason: `${MARCA}: temporada alta de fin de año`,
          employees_id: empleado.employees_id,
        },
      });
    }
  }

  const tarifas = await tx.room_type_rate.findMany({ where: { active: true }, orderBy: { valid_from: 'asc' } });
  mapas.tarifas = new Map();
  for (const tarifa of tarifas) {
    if (!mapas.tarifas.has(tarifa.room_type_id)) mapas.tarifas.set(tarifa.room_type_id, []);
    mapas.tarifas.get(tarifa.room_type_id).push(tarifa);
  }
}

function tarifaPara(roomTypeId, fechaISO) {
  const lista = mapas.tarifas.get(roomTypeId) ?? [];
  let elegida = null;
  for (const tarifa of lista) {
    const desde = iso(tarifa.valid_from);
    const hasta = tarifa.valid_to ? iso(tarifa.valid_to) : '9999-12-31';
    if (desde <= fechaISO && fechaISO < hasta) elegida = tarifa;
  }
  return elegida ?? lista[lista.length - 1] ?? null;
}

async function prepararHabitaciones(tx) {
  // Números de ejemplo poco realistas que se reemplazan por numeración de hotel.
  const renombres = [
    { anterior: 'MAT-001', nuevo: '111', piso: 1, vista: 'Patio interno' },
    { anterior: 'SUITE-6A', nuevo: '511', piso: 5, vista: 'Panorámica' },
  ];
  for (const cambio of renombres) {
    const habitacion = await tx.room.findUnique({ where: { room_number: cambio.anterior } });
    const destino = await tx.room.findUnique({ where: { room_number: cambio.nuevo } });
    if (habitacion && !destino) {
      await tx.room.update({
        where: { room_id: habitacion.room_id },
        data: { room_number: cambio.nuevo, floor_number: cambio.piso, view_type: cambio.vista },
      });
    }
  }

  const nuevas = [];
  for (const [numero, nombreTipo, piso, vista, observaciones] of HABITACIONES_NUEVAS) {
    const tipo = mapas.tipos.get(nombreTipo);
    const habitacion = await tx.room.upsert({
      where: { room_number: numero },
      update: {},
      create: {
        room_number: numero,
        room_type_id: tipo.room_type_id,
        floor_number: piso,
        view_type: vista,
        observations: observaciones,
        room_state: 'DISPONIBLE',
      },
    });
    nuevas.push({ ...habitacion, tipoNombre: nombreTipo, capacidad: tipo.room_type_max_capacity });
  }

  // Se suman las dos habitaciones renombradas para que también participen.
  for (const numero of ['111', '511']) {
    const habitacion = await tx.room.findUnique({ where: { room_number: numero } });
    if (!habitacion) continue;
    const tipo = await tx.room_type.findUnique({ where: { room_type_id: habitacion.room_type_id } });
    nuevas.push({ ...habitacion, tipoNombre: tipo.room_type_name, capacidad: tipo.room_type_max_capacity });
  }

  const conReservas = await tx.reservation.findMany({
    where: { room_id: { in: nuevas.map((h) => h.room_id) } },
    select: { room_id: true },
  });
  const ocupadas = new Set(conReservas.map((fila) => fila.room_id));

  mapas.habitaciones = nuevas.filter((habitacion) => !ocupadas.has(habitacion.room_id));
}

// ---------------------------------------------------------------------------
// 4. Inventario y servicios
// ---------------------------------------------------------------------------

async function prepararInventario(tx) {
  const categoriaMantenimiento = await tx.categories.upsert({
    where: { category_name: 'Insumos de Mantenimiento' },
    update: {},
    create: {
      category_name: 'Insumos de Mantenimiento',
      category_description: 'Pintura, herramientas y repuestos menores',
    },
  });

  const depositoPisos = await tx.deposit.upsert({
    where: { deposit_name: 'Depósito Pisos Altos' },
    update: {},
    create: {
      deposit_name: 'Depósito Pisos Altos',
      deposit_location: 'Piso 5 - Sector servicios',
    },
  });

  const depositos = await tx.deposit.findMany({ where: { deposit_state: true }, orderBy: { deposit_id: 'asc' } });
  const idDeposito = (nombre) => depositos.find((d) => d.deposit_name === nombre)?.deposit_id;
  const central = idDeposito('Depósito Central') ?? depositos[0].deposit_id;
  const piso1 = idDeposito('Office Gobernanza Piso 1') ?? central;
  const piso2 = idDeposito('Office Gobernanza Piso 2') ?? central;
  const bar = idDeposito('Depósito Resto Bar / Frigobar') ?? central;
  const pisos = depositoPisos.deposit_id;

  for (const articulo of ARTICULOS_NUEVOS) {
    // La categoría de mantenimiento se crea en esta misma corrida y no tiene
    // un id fijo: se resuelve por nombre.
    const categoryId = articulo.categoria === 5
      ? categoriaMantenimiento.category_id
      : articulo.categoria;
    await tx.articles.upsert({
      where: { article_code: articulo.codigo },
      update: {},
      create: {
        category_id: categoryId,
        article_code: articulo.codigo,
        article_name: articulo.nombre,
        article_unit_of_measure: articulo.unidad,
        article_stock_min_general: articulo.minimo,
      },
    });
  }

  const articulos = await tx.articles.findMany({ where: { article_state: true }, orderBy: { article_id: 'asc' } });
  mapas.articulos = new Map(articulos.map((articulo) => [articulo.article_code, articulo]));

  // Saldos iniciales: depósito central grande y oficinas con stock operativo.
  for (const articulo of articulos) {
    await asegurarFilaStock(tx, articulo.article_id, central);
    if (['BLA', 'AME', 'LIM'].includes(articulo.article_code.slice(0, 3))) {
      await asegurarFilaStock(tx, articulo.article_id, piso1);
      await asegurarFilaStock(tx, articulo.article_id, piso2);
      await asegurarFilaStock(tx, articulo.article_id, pisos);
    }
    if (articulo.article_code.startsWith('FRI')) {
      await asegurarFilaStock(tx, articulo.article_id, bar);
    }
  }

  // Saldos iniciales por código de artículo y depósito. Cantidades holgadas
  // para que los consumos de la demo nunca dejen el stock en negativo.
  const saldos = {
    'BLA-001': { [central]: 320, [piso1]: 60, [piso2]: 55, [pisos]: 40 },
    'BLA-002': { [central]: 380, [piso1]: 80, [piso2]: 70, [pisos]: 50 },
    'BLA-003': { [central]: 160, [piso1]: 30, [piso2]: 28, [pisos]: 20 },
    'LIM-001': { [central]: 260, [piso1]: 40, [piso2]: 38, [pisos]: 26 },
    'LIM-002': { [central]: 140, [piso1]: 18, [piso2]: 16, [pisos]: 12 },
    'LIM-003': { [central]: 200, [piso1]: 24, [piso2]: 22, [pisos]: 18 },
    'AME-001': { [central]: 420, [piso1]: 90, [piso2]: 85, [pisos]: 60 },
    'AME-002': { [central]: 360, [piso1]: 80, [piso2]: 75, [pisos]: 55 },
    'AME-003': { [central]: 300, [piso1]: 60, [piso2]: 58, [pisos]: 40 },
    'AME-004': { [central]: 180, [piso1]: 30, [piso2]: 28, [pisos]: 20 },
    'FRI-001': { [central]: 240, [bar]: 400 },
    'FRI-002': { [central]: 120, [bar]: 180 },
    'FRI-003': { [central]: 200, [bar]: 320 },
    'FRI-004': { [central]: 160, [bar]: 260 },
    'FRI-005': { [central]: 140, [bar]: 220 },
    'MAN-001': { [central]: 6 },
    'MAN-002': { [central]: 12 },
  };

  for (const articulo of articulos) {
    for (const [depositoId, cantidad] of Object.entries(saldos[articulo.article_code] ?? {})) {
      const fila = await asegurarFilaStock(tx, articulo.article_id, Number(depositoId));
      if (Number(fila.stock_amount) === 0) {
        await tx.articles_deposit_stock.update({
          where: { stock_id: fila.stock_id },
          data: { stock_amount: cantidad },
        });
      }
    }
  }

  return { central, piso1, piso2, bar, pisos, categoriaMantenimiento };
}

async function prepararServicios(tx) {
  const empleado = mapas.empleados.gobernanza;
  const catalogo = [];

  for (const servicio of SERVICIOS_NUEVOS) {
    const articulo = servicio.articulo ? mapas.articulos.get(servicio.articulo) : null;
    const creado = await tx.room_service_catalog.upsert({
      where: { service_name: servicio.nombre },
      update: {},
      create: {
        service_name: servicio.nombre,
        description: servicio.descripcion,
        category: servicio.categoria,
        current_price: servicio.precio,
        created_by: empleado.employees_id,
        inventory_article_id: articulo?.article_id ?? null,
        inventory_deposit_id: servicio.deposito ?? null,
      },
    });
    catalogo.push(creado);
  }

  const existentes = await tx.room_service_catalog.findMany({ where: { active: true }, orderBy: { service_id: 'asc' } });
  mapas.servicios = existentes;

  // Historial de precios de ejemplo para los servicios que ya existían.
  for (const servicio of existentes) {
    const historial = await tx.room_service_price_history.count({ where: { service_id: servicio.service_id } });
    if (historial) continue;
    const precioActual = Number(servicio.current_price);
    const anterior = redondear(precioActual * 0.82, 100);
    await tx.room_service_price_history.create({
      data: {
        service_id: servicio.service_id,
        previous_price: anterior,
        new_price: precioActual,
        valid_from: instante(`${ANIO}-06-01`, '09:00:00'),
        employees_id: empleado.employees_id,
      },
    });
  }

}

// ---------------------------------------------------------------------------
// 5. Huéspedes
// ---------------------------------------------------------------------------

async function prepararHuespedes(tx) {
  const existentes = await tx.guest.findMany({ select: { document_type: true, document_number: true } });
  const usados = new Set(existentes.map((g) => `${g.document_type}:${g.document_number}`));

  const huespedes = [];
  let numeroDocumento = 30000000;

  for (let indice = 0; indice < 140; indice += 1) {
    const esExtranjero = azar(0.18);
    const esMujer = azar(0.5);
    const nombre = elegir(esMujer ? NOMBRES_F : NOMBRES_M);
    const apellido = elegir(APELLIDOS);
    const extranjero = elegir(EXTRANJEROS);

    let tipoDocumento = 'DNI';
    let documento;
    if (esExtranjero) {
      tipoDocumento = 'PASAPORTE';
      documento = `${extranjero.prefijo}${entero(100000, 999999)}`;
    } else {
      do {
        numeroDocumento += entero(7, 41);
        documento = String(numeroDocumento);
      } while (usados.has(`DNI:${documento}`));
    }
    while (usados.has(`${tipoDocumento}:${documento}`)) {
      documento = `${tipoDocumento === 'DNI' ? '' : extranjero.prefijo}${entero(100000, 999999)}`;
    }
    usados.add(`${tipoDocumento}:${documento}`);

    const nacimiento = esExtranjero ? entero(1960, 2003) : entero(1955, 2004);
    const mes = String(entero(1, 12)).padStart(2, '0');
    const dia = String(entero(1, 28)).padStart(2, '0');
    const email = `${normalizar(nombre)}.${normalizar(apellido)}${indice + 1}@correo.com`;
    const telefono = `+54 9 387 ${entero(400, 699)}-${entero(1000, 9999)}`;

    const creado = await tx.guest.create({
      data: {
        document_type: tipoDocumento,
        document_number: documento,
        first_name: nombre,
        last_name: apellido,
        email,
        phone: telefono,
        birth_date: fecha(`${nacimiento}-${mes}-${dia}`),
        nationality: esExtranjero ? extranjero.pais : 'Argentina',
        address: esExtranjero
          ? `${elegir(CALLES)} ${entero(100, 1500)}, ${extranjero.pais}`
          : `${elegir(CALLES)} ${entero(100, 1999)}, ${elegir(CIUDADES)}, Salta`,
        observations: MARCA,
      },
    });
    huespedes.push(creado);
  }

  mapas.huespedes = huespedes;
}

// ---------------------------------------------------------------------------
// 6. Reservas, cobros, consumos y estadías
// ---------------------------------------------------------------------------

function estadoSegunFechas(checkIn, checkOut) {
  if (checkOut <= HOY) {
    const sorteo = rng();
    if (sorteo < 0.06) return 'CANCELADA';
    if (sorteo < 0.1) return 'NO_SHOW';
    return 'FINALIZADA';
  }
  if (checkIn <= HOY) return 'IN_HOUSE';
  return azar(0.85) ? 'CONFIRMADA' : 'PENDIENTE';
}

function planDeEstadias() {
  const planes = [];
  for (const habitacion of mapas.habitaciones) {
    const estadias = [];
    let cursor = sumarDias(`${ANIO}-01-03`, entero(0, 12));
    let vueltas = 0;
    while (estadias.length < 11 && vueltas < 40) {
      vueltas += 1;
      const noches = elegirPonderado([[1, 1], [2, 2], [3, 4], [4, 3], [5, 1]]);
      const salida = sumarDias(cursor, noches);
      if (salida > `${ANIO}-12-22`) break;
      const estado = estadoSegunFechas(cursor, salida);
      estadias.push({ checkIn: cursor, checkOut: salida, noches, estado });
      const descanso = estado === 'CANCELADA' ? entero(6, 18) : entero(13, 38);
      cursor = sumarDias(salida, descanso);
    }
    planes.push({ habitacion, estadias });
  }
  return planes;
}

function acompanantesPara(reservaSecuencia, adultos, ninos) {
  const acompanantes = [];
  const total = Math.max(0, adultos + ninos - 1);
  for (let indice = 0; indice < total; indice += 1) {
    const esMenor = indice >= adultos - 1;
    const esMujer = azar(0.5);
    acompanantes.push({
      rol: 'ACOMPANANTE',
      tipo: esMenor ? 'MENOR' : 'ADULTO',
      documento: {
        tipo: 'DNI',
        numero: String(40000000 + ((reservaSecuencia * 17 + indice * 31) % 15000000)),
      },
      nombre: elegir(esMujer ? NOMBRES_F : NOMBRES_M),
      apellido: elegir(APELLIDOS),
    });
  }
  return acompanantes;
}

async function registrarConsumoMinibar(tx, servicio, cantidad, fechaISO, hora, reservaCodigo) {
  if (!servicio.inventory_article_id || !servicio.inventory_deposit_id) return true;
  const fila = await restarStock(tx, servicio.inventory_article_id, servicio.inventory_deposit_id, cantidad);
  if (!fila) return false;

  mapas.contadores.movimiento += 1;
  const tipo = mapas.tiposMovimiento.get('CONSUMO');
  const movimiento = await tx.stock_movement.create({
    data: {
      movement_type_id: tipo.movement_type_id,
      deposit_origin_id: servicio.inventory_deposit_id,
      employees_id: mapas.empleados.gobernanza.employees_id,
      observations: `${MARCA}: consumo minibar ${reservaCodigo}`,
      transaction_date: instante(fechaISO, hora),
    },
  });
  await tx.movement_stock_detail.create({
    data: { stock_movement_id: movimiento.stock_movement_id, stock_id: fila.stock_id, amount: cantidad },
  });
  return true;
}

async function prepararReservas(tx) {
  const planes = planDeEstadias();
  const reservasPorHabitacion = new Map();
  const recepcion = mapas.empleados.recepcion;
  const servicios = mapas.servicios;
  const serviciosMinibar = servicios.filter((s) => s.category === 'MINIBAR');
  const serviciosOtros = servicios.filter((s) => s.category !== 'MINIBAR');

  // Los huéspedes más usados se repiten: da sensación de clientela recurrente.
  const frecuentes = mapas.huespedes.slice(0, 40);

  for (const plan of planes) {
    const lista = [];
    for (const estadia of plan.estadias) {
      mapas.contadores.reserva += 1;
      const secuencia = mapas.contadores.reserva;
      const codigo = `RES-MAS-${String(secuencia).padStart(4, '0')}`;
      const { habitacion, } = plan;
      const { checkIn, checkOut, noches, estado } = estadia;

      const tarifa = tarifaPara(habitacion.room_type_id, checkIn);
      const precioBase = tarifa ? Number(tarifa.base_price) : 80000;
      const finDeSemana = [5, 6].includes(diaSemana(checkIn));
      const precio = redondear(precioBase * (finDeSemana ? 1.08 : 1), 500);

      const capacidad = Number(habitacion.capacidad ?? 2);
      let adultos = capacidad <= 1 ? 1 : elegirPonderado([[1, 1], [2, 7], [3, capacidad >= 3 ? 2 : 0], [4, capacidad >= 4 ? 1 : 0]]);
      adultos = Math.min(Math.max(1, adultos), capacidad);
      const lugarParaNinos = capacidad - adultos;
      const ninos = capacidad >= 3 && lugarParaNinos >= 1 && azar(0.35)
        ? entero(1, Math.min(2, lugarParaNinos))
        : 0;

      const origen = elegirPonderado([
        ['RECEPCION', 45], ['WEB', 26], ['TELEFONO', 12], ['AGENCIA', 10], ['CORPORATIVO', 7],
      ]);
      const huesped = azar(0.35) ? elegir(frecuentes) : elegir(mapas.huespedes);
      const empleado = elegir(recepcion);
      const politica = elegirPonderado([[1, 4], [2, 3], [3, 2], [4, 1]]);

      const diasAnticipacion = origen === 'WEB' ? entero(5, 45) : entero(1, 30);
      const creacionISO = restarDias(checkIn, diasAnticipacion) < `${ANIO - 1}-12-01`
        ? `${ANIO - 1}-12-01`
        : restarDias(checkIn, diasAnticipacion);
      const creacion = instante(creacionISO, horaAzar(9, 19));

      const cancelada = estado === 'CANCELADA';
      const pendiente = estado === 'PENDIENTE';
      const cancelacionISO = sumarDias(creacionISO, entero(1, 3));
      const cancelacion = cancelada
        ? {
            cancelled_at: instante(cancelacionISO > checkIn ? checkIn : cancelacionISO, '11:30:00'),
            cancellation_reason: elegir([
              'El huésped canceló por cambio de planes.',
              'Cancelación solicitada por la agencia.',
              'Reprogramación del viaje.',
              'El huésped encontró otra opción de alojamiento.',
            ]),
          }
        : {};
      const observaciones = origen === 'CORPORATIVO'
        ? `${MARCA}: estadía corporativa — ${elegir(['Minera del Altiplano', 'Banco Macro', 'Telecom Argentina', 'YPF S.A.'])}`
        : origen === 'AGENCIA'
          ? `${MARCA}: reserva de agencia — ${elegir(['Turismo Norte', 'Andes Travel', 'Salta Receptivo'])}`
          : null;

      const reserva = await tx.reservation.create({
        data: {
          reservation_code: codigo,
          guest_id: huesped.guest_id,
          room_id: habitacion.room_id,
          check_in_date: fecha(checkIn),
          check_out_date: fecha(checkOut),
          adults: adultos,
          children: ninos,
          price_per_night: precio,
          rate_id: tarifa?.rate_id ?? null,
          policy_id: politica,
          reservation_status: cancelada || estado === 'NO_SHOW' ? estado : 'CONFIRMADA',
          reservation_source: origen,
          observations: observaciones,
          employees_id: empleado.employees_id,
          creation_date: creacion,
          pending_expires_at: pendiente ? instante(sumarDias(creacionISO, 2), '23:59:00') : null,
          arrival_time: origen === 'WEB' ? new Date('1970-01-01T14:00:00Z') : null,
          estimated_departure_time: origen === 'WEB' ? new Date('1970-01-01T10:00:00Z') : null,
          ...cancelacion,
        },
      });

      if (estado === 'NO_SHOW') {
        await tx.reservation.update({
          where: { reservation_id: reserva.reservation_id },
          data: { reservation_status: 'NO_SHOW' },
        });
      }

      const totalAlojamiento = dinero(noches * precio);

      // ---- Cobros de alojamiento -------------------------------------------
      const metodo = () => elegir(mapas.metodosPago).payment_method_id;
      const referencia = (prefijo) => {
        mapas.contadores.pago += 1;
        return `${prefijo}-${String(mapas.contadores.pago).padStart(5, '0')}`;
      };

      if (estado === 'FINALIZADA') {
        const senia = dinero(totalAlojamiento * 0.3);
        const saldo = dinero(totalAlojamiento - senia);
        await tx.reservation_payment.create({
          data: {
            reservation_id: reserva.reservation_id,
            payment_method_id: metodo(),
            amount: senia,
            paid_at: instante(creacionISO, horaAzar(10, 18)),
            payment_reference: referencia('MAS-PAGO'),
            employees_id: empleado.employees_id,
          },
        });
        await tx.reservation_payment.create({
          data: {
            reservation_id: reserva.reservation_id,
            payment_method_id: metodo(),
            amount: saldo,
            paid_at: instante(checkIn, '14:35:00'),
            payment_reference: referencia('MAS-PAGO'),
            employees_id: elegir(recepcion).employees_id,
          },
        });
      } else if (estado === 'IN_HOUSE') {
        await tx.reservation_payment.create({
          data: {
            reservation_id: reserva.reservation_id,
            payment_method_id: metodo(),
            amount: dinero(totalAlojamiento * 0.5),
            paid_at: instante(creacionISO, horaAzar(10, 18)),
            payment_reference: referencia('MAS-PAGO'),
            employees_id: empleado.employees_id,
          },
        });
      } else if (estado === 'CONFIRMADA' && azar(0.45)) {
        await tx.reservation_payment.create({
          data: {
            reservation_id: reserva.reservation_id,
            payment_method_id: metodo(),
            amount: dinero(totalAlojamiento * 0.3),
            paid_at: instante(creacionISO, horaAzar(10, 18)),
            payment_reference: referencia('MAS-PAGO'),
            employees_id: empleado.employees_id,
          },
        });
      }

      // ---- Consumos y servicios de habitación -------------------------------
      if (estado === 'FINALIZADA' || estado === 'IN_HOUSE') {
        const cantidadConsumos = elegirPonderado([[0, 3], [1, 4], [2, 3], [3, 1]]);
        for (let indice = 0; indice < cantidadConsumos; indice += 1) {
          const usaMinibar = azar(0.35) && serviciosMinibar.length > 0;
          const servicio = usaMinibar ? elegir(serviciosMinibar) : elegir(serviciosOtros.length ? serviciosOtros : servicios);
          const cantidad = usaMinibar ? entero(1, 3) : 1;
          const diaConsumo = sumarDias(checkIn, entero(0, Math.max(0, noches - 1)));
          const diaValido = diaConsumo > HOY ? HOY : diaConsumo;
          const hora = horaAzar(9, 22);

          if (usaMinibar) {
            const consumido = await registrarConsumoMinibar(tx, servicio, cantidad, diaValido, hora, codigo);
            if (!consumido) continue;
          }

          mapas.contadores.cargo += 1;
          const pago = azar(0.78);
          const fechaPago = pago
            ? instante(diaValido, horaAzar(9, 23) > '23:00:00' ? '22:30:00' : horaAzar(9, 22))
            : null;

          await tx.room_service_charge.create({
            data: {
              reservation_id: reserva.reservation_id,
              room_id: habitacion.room_id,
              service_id: servicio.service_id,
              service_name: servicio.service_name,
              quantity: cantidad,
              unit_price: servicio.current_price,
              charged_at: instante(diaValido, hora),
              employees_id: elegir(recepcion).employees_id,
              paid_at: fechaPago,
              paid_by: pago ? elegir(recepcion).employees_id : null,
              payment_method_id: pago ? metodo() : null,
              payment_reference: pago ? `MAS-CARGO-${String(mapas.contadores.cargo).padStart(5, '0')}` : null,
            },
          });
        }
      }

      // ---- Check-in / check-out --------------------------------------------
      if (estado === 'FINALIZADA' || estado === 'IN_HOUSE') {
        await tx.reservation_check_in.create({
          data: {
            reservation_id: reserva.reservation_id,
            check_in_at: instante(checkIn, `14:${String(entero(0, 55)).padStart(2, '0')}:00`),
            actual_adults: adultos,
            actual_children: ninos,
            observations: `${MARCA}: check-in registrado por recepción`,
            employees_id: elegir(recepcion).employees_id,
          },
        });

        await tx.reservation_stay_guest.create({
          data: {
            reservation_id: reserva.reservation_id,
            guest_role: 'TITULAR',
            person_type: 'ADULTO',
            document_type: huesped.document_type,
            document_number: huesped.document_number,
            first_name: huesped.first_name,
            last_name: huesped.last_name,
            recorded_at: instante(checkIn, '14:20:00'),
            employees_id: elegir(recepcion).employees_id,
          },
        });
        for (const acompanante of acompanantesPara(secuencia, adultos, ninos)) {
          await tx.reservation_stay_guest.create({
            data: {
              reservation_id: reserva.reservation_id,
              guest_role: acompanante.rol,
              person_type: acompanante.tipo,
              document_type: acompanante.documento.tipo,
              document_number: acompanante.documento.numero,
              first_name: acompanante.nombre,
              last_name: acompanante.apellido,
              recorded_at: instante(checkIn, '14:25:00'),
              employees_id: elegir(recepcion).employees_id,
            },
          });
        }
      }

      if (estado === 'FINALIZADA') {
        await tx.reservation_check_out.create({
          data: {
            reservation_id: reserva.reservation_id,
            check_out_at: instante(checkOut, `10:${String(entero(0, 45)).padStart(2, '0')}:00`),
            pending_charges: false,
            observations: `${MARCA}: salida conforme`,
            employees_id: elegir(recepcion).employees_id,
          },
        });
      }

      // ---- Pedido web -------------------------------------------------------
      if (origen === 'WEB') {
        const contenido = crypto
          .createHash('sha256')
          .update(`${codigo}|${huesped.email}|${checkIn}|${checkOut}`)
          .digest('hex');
        const confirmacion = {
          codigo,
          hotel: 'Hotel Alejandro I',
          huesped: `${huesped.first_name} ${huesped.last_name}`,
          check_in: checkIn,
          check_out: checkOut,
          adultos,
          ninos,
          importe_total: totalAlojamiento,
        };
        const envio = azar(0.9) ? instante(creacionISO, '09:05:00') : null;
        await tx.$executeRawUnsafe(
          `INSERT INTO reservation_web_request
             (request_id, payload_hash, reservation_id, confirmation, email_sent_at, email_attempts, email_next_attempt)
           VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7)
           ON CONFLICT (reservation_id) DO NOTHING`,
          crypto.randomUUID(),
          contenido,
          reserva.reservation_id,
          JSON.stringify(confirmacion),
          envio,
          envio ? 1 : 2,
          instante(creacionISO, '09:20:00'),
        );
      }

      lista.push({
        reservation_id: reserva.reservation_id,
        codigo,
        checkIn,
        checkOut,
        estado,
        habitacion,
      });
    }
    reservasPorHabitacion.set(plan.habitacion.room_id, lista);
  }

  return reservasPorHabitacion;
}

/**
 * Reservas futuras: completa el calendario desde hoy hasta fin de año.
 * Son reservas confirmadas o pendientes, sin check-in, para que las pantallas
 * de calendario, disponibilidad y "próximas llegadas" tengan movimiento.
 */
async function prepararReservasFuturas(tx) {
  const marcador = await tx.hotel_parameter.findUnique({ where: { parameter_key: CLAVE_MARCADOR_FUTURAS } });
  if (marcador) return 0;

  const recepcion = mapas.empleados.recepcion;

  // La numeración continúa desde la última reserva futura que ya exista, por
  // si se borró el marcador a mano.
  const previas = await tx.reservation.findMany({
    where: { reservation_code: { startsWith: 'RES-FUT-' } },
    select: { reservation_code: true },
  });
  let secuencia = previas.reduce(
    (maximo, fila) => Math.max(maximo, Number(fila.reservation_code.slice('RES-FUT-'.length)) || 0),
    0,
  );

  for (const habitacion of mapas.habitaciones) {
    const ultima = await tx.reservation.findFirst({
      where: {
        room_id: habitacion.room_id,
        reservation_status: { in: ['PENDIENTE', 'CONFIRMADA', 'IN_HOUSE'] },
      },
      orderBy: { check_out_date: 'desc' },
    });
    const mantenimiento = await tx.room_maintenance.findFirst({
      where: { room_id: habitacion.room_id, actual_end_date: null },
      orderBy: { estimated_end_date: 'desc' },
    });

    let piso = HOY;
    if (ultima) piso = iso(ultima.check_out_date) > piso ? iso(ultima.check_out_date) : piso;
    if (mantenimiento) {
      const finBloqueo = iso(mantenimiento.estimated_end_date);
      if (finBloqueo > piso) piso = finBloqueo;
    }

    // Se encadenan estadías hasta fin de año (la última puede salir en los
    // primeros días de enero) para que el calendario no quede con huecos.
    const LIMITE_ENTRADA = `${ANIO}-12-31`;
    const LIMITE_SALIDA = `${ANIO + 1}-01-05`;
    let cursor = sumarDias(piso, entero(2, 7));
    let guardia = 0;
    while (guardia < 30) {
      guardia += 1;
      if (cursor > LIMITE_ENTRADA) break;

      const noches = elegirPonderado([[1, 1], [2, 3], [3, 4], [4, 2], [5, 1]]);
      const salida = sumarDias(cursor, noches);
      if (salida > LIMITE_SALIDA) break;

      const tarifa = tarifaPara(habitacion.room_type_id, cursor);
      const precio = redondear(Number(tarifa?.base_price ?? 80000) * (azar(0.3) ? 1.05 : 1), 500);
      const capacidad = Number(habitacion.capacidad ?? 2);
      const adultos = Math.min(capacidad, capacidad <= 1 ? 1 : entero(1, Math.min(2, capacidad)));
      const ninos = capacidad >= 3 && azar(0.3) ? 1 : 0;
      const origen = elegirPonderado([
        ['RECEPCION', 35], ['WEB', 35], ['TELEFONO', 12], ['AGENCIA', 10], ['CORPORATIVO', 8],
      ]);
      const huesped = elegir(mapas.huespedes);
      const empleado = elegir(recepcion);
      const estado = azar(0.82) ? 'CONFIRMADA' : 'PENDIENTE';
      const diasAnticipacion = entero(0, 20);
      const creacionISO = restarDias(cursor, diasAnticipacion) < HOY ? HOY : restarDias(cursor, diasAnticipacion);

      secuencia += 1;
      const codigo = `RES-FUT-${String(secuencia).padStart(4, '0')}`;
      const reserva = await tx.reservation.create({
        data: {
          reservation_code: codigo,
          guest_id: huesped.guest_id,
          room_id: habitacion.room_id,
          check_in_date: fecha(cursor),
          check_out_date: fecha(salida),
          adults: Math.max(1, adultos - ninos),
          children: ninos,
          price_per_night: precio,
          rate_id: tarifa?.rate_id ?? null,
          policy_id: elegirPonderado([[1, 4], [2, 3], [3, 2], [4, 1]]),
          reservation_status: estado,
          reservation_source: origen,
          employees_id: empleado.employees_id,
          creation_date: instante(creacionISO, horaAzar(9, 19)),
          pending_expires_at: estado === 'PENDIENTE' ? instante(sumarDias(creacionISO, 2), '23:59:00') : null,
          observations: origen === 'CORPORATIVO' ? `${MARCA}: estadía corporativa` : null,
        },
      });

      if (estado === 'CONFIRMADA' && azar(0.5)) {
        await tx.reservation_payment.create({
          data: {
            reservation_id: reserva.reservation_id,
            payment_method_id: elegir(mapas.metodosPago).payment_method_id,
            amount: dinero(noches * precio * 0.3),
            paid_at: instante(creacionISO, horaAzar(10, 18)),
            payment_reference: `MAS-PAGO-${String(++mapas.contadores.pago).padStart(5, '0')}`,
            employees_id: empleado.employees_id,
          },
        });
      }

      if (origen === 'WEB') {
        const hash = crypto.createHash('sha256').update(`${codigo}|${huesped.email}`).digest('hex');
        await tx.$executeRawUnsafe(
          `INSERT INTO reservation_web_request
             (request_id, payload_hash, reservation_id, confirmation, email_sent_at, email_attempts, email_next_attempt)
           VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7)
           ON CONFLICT (reservation_id) DO NOTHING`,
          crypto.randomUUID(),
          hash,
          reserva.reservation_id,
          JSON.stringify({ codigo, check_in: cursor, check_out: salida, estado }),
          instante(creacionISO, '09:10:00'),
          1,
          instante(creacionISO, '09:20:00'),
        );
      }

      cursor = sumarDias(salida, entero(2, 7));
    }
  }

  await tx.hotel_parameter.create({
    data: {
      parameter_key: CLAVE_MARCADOR_FUTURAS,
      parameter_value: VERSION,
      description: 'Marca de las reservas futuras de la carga masiva (seed-demo-masivo.js)',
    },
  });

  return secuencia;
}

/**
 * Deja los mapas en memoria listos para generar reservas sin repetir el alta
 * de habitaciones, tarifas y huéspedes (modo `--futuras` sobre una base ya
 * cargada).
 */
async function cargarContextoReservas(tx) {
  await prepararEmpleados(tx);
  await prepararCatalogos(tx);

  const habitaciones = await tx.room.findMany({
    where: { active: true, room_type: { room_type_state: true } },
    include: { room_type: true },
    orderBy: { room_number: 'asc' },
  });
  mapas.habitaciones = habitaciones.map((habitacion) => ({
    ...habitacion,
    tipoNombre: habitacion.room_type.room_type_name,
    capacidad: habitacion.room_type.room_type_max_capacity,
  }));

  const tarifas = await tx.room_type_rate.findMany({
    where: { active: true },
    orderBy: { valid_from: 'asc' },
  });
  mapas.tarifas = new Map();
  for (const tarifa of tarifas) {
    if (!mapas.tarifas.has(tarifa.room_type_id)) mapas.tarifas.set(tarifa.room_type_id, []);
    mapas.tarifas.get(tarifa.room_type_id).push(tarifa);
  }

  mapas.huespedes = await tx.guest.findMany({
    where: { guest_state: true },
    orderBy: { guest_id: 'asc' },
  });
  if (!mapas.huespedes.length) throw new Error('No hay huéspedes cargados para generar reservas futuras.');
}

/**
 * Borra únicamente las reservas generadas por `prepararReservasFuturas` y sus
 * cobros, para poder regenerarlas desde cero. No toca el resto de la carga.
 */
async function borrarReservasFuturas(tx) {
  const cobros = await tx.$executeRawUnsafe(`
    DELETE FROM reservation_payment
    WHERE reservation_id IN (SELECT reservation_id FROM reservation WHERE reservation_code LIKE 'RES-FUT-%')
  `);
  const reservas = await tx.$executeRawUnsafe(
    `DELETE FROM reservation WHERE reservation_code LIKE 'RES-FUT-%'`,
  );
  await tx.hotel_parameter.deleteMany({ where: { parameter_key: CLAVE_MARCADOR_FUTURAS } });
  return { cobros, reservas };
}

// ---------------------------------------------------------------------------
// 7. Mantenimiento, retenciones y auditoría
// ---------------------------------------------------------------------------

async function prepararMantenimientos(tx, reservasPorHabitacion) {
  const gobernanza = mapas.empleados.gobernanza;
  const tipos = ['MANTENIMIENTO', 'LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'LIMPIEZA', 'MANTENIMIENTO'];
  const razones = [
    'Reparación de aire acondicionado',
    'Cambio de grifería en el baño',
    'Pintura de la habitación',
    'Limpieza profunda de alfombra y cortinas',
    'Revisión de instalación eléctrica',
    'Cambio de colchón y sommier',
  ];

  let creados = 0;
  for (const habitacion of mapas.habitaciones) {
    if (creados >= 6) break;
    const reservas = (reservasPorHabitacion.get(habitacion.room_id) ?? [])
      .filter((reserva) => reserva.estado !== 'CANCELADA')
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    let hueco = null;
    for (let posicion = 0; posicion < reservas.length - 1; posicion += 1) {
      const salida = reservas[posicion].checkOut;
      const entrada = reservas[posicion + 1].checkIn;
      if (entrada <= HOY && diferenciaDias(entrada, salida) >= 6) {
        hueco = { desde: sumarDias(salida, 1), hasta: entrada };
        break;
      }
    }
    if (!hueco) continue;

    const estadoActual = await tx.room.findUnique({
      where: { room_id: habitacion.room_id },
      select: { room_state: true },
    });
    if (estadoActual?.room_state === 'OCUPADA') continue;

    const inicio = hueco.desde;
    const fin = sumarDias(inicio, entero(1, Math.min(3, diferenciaDias(hueco.hasta, inicio) - 1)));
    if (fin >= hueco.hasta) continue;

    await tx.room_maintenance.create({
      data: {
        room_id: habitacion.room_id,
        maintenance_type: tipos[creados % tipos.length],
        start_date: fecha(inicio),
        estimated_end_date: fecha(fin),
        actual_end_date: fecha(fin),
        reason: `${MARCA}: ${razones[creados % razones.length]}`,
        closing_notes: 'Trabajo finalizado y habitación habilitada.',
        opened_by: gobernanza.employees_id,
        closed_by: gobernanza.employees_id,
      },
    });
    creados += 1;
  }

  // Un bloqueo vigente para que housekeeping muestre una habitación fuera de servicio.
  const hoy = HOY;
  for (const habitacion of mapas.habitaciones) {
    const reservas = reservasPorHabitacion.get(habitacion.room_id) ?? [];
    const enCasa = reservas.some((reserva) => reserva.estado === 'IN_HOUSE');
    if (enCasa) continue;

    const proxima = reservas
      .filter((reserva) => ['CONFIRMADA', 'PENDIENTE'].includes(reserva.estado) && reserva.checkIn > hoy)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    if (proxima && diferenciaDias(proxima.checkIn, hoy) <= 4) continue;

    const estadoActual = await tx.room.findUnique({ where: { room_id: habitacion.room_id }, select: { room_state: true } });
    if (estadoActual?.room_state === 'OCUPADA') continue;

    await tx.room_maintenance.create({
      data: {
        room_id: habitacion.room_id,
        maintenance_type: 'MANTENIMIENTO',
        start_date: fecha(hoy),
        estimated_end_date: fecha(sumarDias(hoy, 4)),
        reason: `${MARCA}: puesta a punto de fin de temporada`,
        opened_by: gobernanza.employees_id,
      },
    });
    break;
  }
}

async function prepararRetenciones(tx) {
  const recepcion = mapas.empleados.recepcion[0];
  const elegidas = mapas.habitaciones.slice(0, 4);
  for (const [indice, habitacion] of elegidas.entries()) {
    await tx.room_hold.create({
      data: {
        room_id: habitacion.room_id,
        check_in_date: fecha(`${ANIO + 1}-01-${String(10 + indice * 2).padStart(2, '0')}`),
        check_out_date: fecha(`${ANIO + 1}-01-${String(12 + indice * 2).padStart(2, '0')}`),
        employees_id: recepcion.employees_id,
        created_at: instante(HOY, '11:00:00'),
        expires_at: instante(HOY, '11:10:00'),
        released: false,
      },
    });
  }
  // Retenciones históricas ya liberadas.
  for (const habitacion of elegidas.slice(0, 2)) {
    await tx.room_hold.create({
      data: {
        room_id: habitacion.room_id,
        check_in_date: fecha(`${ANIO}-09-10`),
        check_out_date: fecha(`${ANIO}-09-12`),
        employees_id: recepcion.employees_id,
        created_at: instante(`${ANIO}-09-09`, '16:00:00'),
        expires_at: instante(`${ANIO}-09-09`, '16:10:00'),
        released: true,
      },
    });
  }
}

async function prepararAuditoriaReservas(tx, reservasPorHabitacion) {
  const recepcion = mapas.empleados.recepcion;
  const todas = [...reservasPorHabitacion.values()].flat().filter((r) => r.estado !== 'CANCELADA');
  const elegidas = todas.filter((_, indice) => indice % 17 === 0).slice(0, 24);

  for (const reserva of elegidas) {
    const campo = elegir(['check_in_date', 'check_out_date', 'price_per_night']);
    const anterior = campo === 'price_per_night' ? '85000.00' : reserva.checkIn;
    const nuevo = campo === 'price_per_night' ? '92000.00' : sumarDias(reserva.checkIn, 1);
    await tx.reservation_change_log.create({
      data: {
        reservation_id: reserva.reservation_id,
        changed_field: campo,
        previous_value: anterior,
        new_value: nuevo,
        changed_at: instante(sumarDias(reserva.checkIn, -2), horaAzar(10, 18)),
        employees_id: elegir(recepcion).employees_id,
        reason: `${MARCA}: ajuste solicitado por el huésped`,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 8. Movimientos de stock
// ---------------------------------------------------------------------------

async function prepararMovimientosStock(tx, depositos) {
  const empleadoStock = mapas.empleados.stock;
  const proveedores = [...mapas.proveedores.values()];
  const articulos = [...mapas.articulos.values()];

  const articuloPorCodigo = (codigo) => mapas.articulos.get(codigo);
  const articulosLimpieza = articulos.filter((a) => a.article_code.startsWith('LIM'));
  const articulosBlancos = articulos.filter((a) => a.article_code.startsWith('BLA'));
  const articulosAmenities = articulos.filter((a) => a.article_code.startsWith('AME'));
  const articulosFrigobar = articulos.filter((a) => a.article_code.startsWith('FRI'));

  // Compras mensuales al depósito central.
  for (let mes = 1; mes <= 10; mes += 1) {
    const mesTexto = String(mes).padStart(2, '0');
    const dia = String(entero(3, 9)).padStart(2, '0');
    const items = [];
    for (const grupo of [articulosBlancos, articulosAmenities, articulosLimpieza, articulosFrigobar]) {
      for (const articulo of grupo.slice(0, 2)) {
        items.push({ articulo: articulo.article_id, cantidad: entero(25, 120) });
      }
    }
    await crearMovimiento(tx, {
      tipo: 'INGRESO',
      destino: depositos.central,
      proveedor: elegir(proveedores),
      empleado: empleadoStock.employees_id,
      fecha: `${ANIO}-${mesTexto}-${dia}`,
      hora: horaAzar(8, 12),
      observaciones: `compra mensual de insumos ${mesTexto}/${ANIO}`,
      items,
    });
  }

  // Reposiciones semanales a las oficinas de gobernanza.
  for (let semana = 0; semana < 12; semana += 1) {
    const fechaISO = sumarDias(`${ANIO}-02-03`, semana * 22 + entero(0, 5));
    if (fechaISO > HOY) break;
    for (const destino of [depositos.piso1, depositos.piso2, depositos.pisos]) {
      const items = [...articulosBlancos.slice(0, 2), ...articulosAmenities.slice(0, 3)]
        .map((articulo) => ({ articulo: articulo.article_id, cantidad: entero(6, 24) }));
      await crearMovimiento(tx, {
        tipo: 'TRANSFERENCIA',
        origen: depositos.central,
        destino,
        empleado: mapas.empleados.gobernanza.employees_id,
        fecha: fechaISO,
        hora: horaAzar(8, 11),
        observaciones: `reposición semanal oficina de gobernanza`,
        items,
      });
    }
  }

  // Consumos internos de limpieza.
  for (let mes = 1; mes <= 10; mes += 1) {
    const fechaISO = `${ANIO}-${String(mes).padStart(2, '0')}-${String(entero(10, 25)).padStart(2, '0')}`;
    if (fechaISO > HOY) break;
    const items = articulosLimpieza.map((articulo) => ({ articulo: articulo.article_id, cantidad: entero(2, 8) }));
    await crearMovimiento(tx, {
      tipo: 'CONSUMO',
      origen: depositos.piso1,
      empleado: mapas.empleados.gobernanza.employees_id,
      fecha: fechaISO,
      hora: horaAzar(9, 17),
      observaciones: `consumo interno de limpieza ${String(mes).padStart(2, '0')}/${ANIO}`,
      items,
    });
  }

  // Ajustes de inventario y una salida por mantenimiento.
  const ajustes = [
    ['AJUSTE_NEGATIVO', `${ANIO}-04-18`, 'diferencia de inventario en conteo físico', articuloPorCodigo('BLA-002'), depositos.central, 4],
    ['AJUSTE_POSITIVO', `${ANIO}-06-12`, 'sobrante detectado en conteo físico', articuloPorCodigo('AME-001'), depositos.central, 6],
    ['AJUSTE_NEGATIVO', `${ANIO}-08-22`, 'rotura de mercadería en depósito', articuloPorCodigo('FRI-003'), depositos.bar, 8],
    ['EGRESO', `${ANIO}-09-05`, 'entrega de insumos a mantenimiento', articuloPorCodigo('MAN-001'), depositos.central, 1],
    ['EGRESO', `${ANIO}-09-05`, 'pintura para habitaciones en refacción', articuloPorCodigo('MAN-002'), depositos.central, 2],
  ];
  for (const [tipo, fechaISO, observaciones, articulo, deposito, cantidad] of ajustes) {
    if (!articulo || fechaISO > HOY) continue;
    await crearMovimiento(tx, {
      tipo,
      origen: ['RESTA', 'TRANSFERENCIA'].includes(mapas.tiposMovimiento.get(tipo).effect) ? deposito : null,
      destino: mapas.tiposMovimiento.get(tipo).effect === 'SUMA' ? deposito : null,
      empleado: empleadoStock.employees_id,
      fecha: fechaISO,
      hora: horaAzar(10, 16),
      observaciones,
      items: [{ articulo: articulo.article_id, cantidad }],
    });
  }
}

// ---------------------------------------------------------------------------
// 9. Egresos: comprobantes, gastos, órdenes de pago y cuenta corriente
// ---------------------------------------------------------------------------

function tipoComprobantePara(proveedor, indice) {
  const condicion = proveedor.tax_condition_id;
  if (condicion === 2) return mapas.tiposComprobante.get('FACTURA_C');
  if (condicion === 3) return mapas.tiposComprobante.get('FACTURA_B');
  return mapas.tiposComprobante.get(indice % 5 === 0 ? 'FACTURA_B' : 'FACTURA_A');
}

async function prepararEgresos(tx, proveedores) {
  const empleadoStock = mapas.empleados.stock;
  const empleadoAdmin = mapas.empleados.admin;
  const articulos = [...mapas.articulos.values()];
  const meses = Array.from({ length: 10 }, (_, indice) => indice + 1);

  const comprobantes = [];
  const gastos = [];
  let numeroComprobante = 9000;

  for (const mes of meses) {
    const mesTexto = String(mes).padStart(2, '0');

    // ---- Orden de compra del mes ----------------------------------------
    const proveedorOC = proveedores[(mes * 3) % proveedores.length];
    const numeroOC = `OC-MAS-${String(mes).padStart(3, '0')}`;
    const ordenCompra = await tx.purchase_order.upsert({
      where: { purchase_order_number: numeroOC },
      update: {},
      create: {
        purchase_order_number: numeroOC,
        supplier_id: proveedorOC.supplier_id,
        issue_date: fecha(`${ANIO}-${mesTexto}-02`),
        expected_date: fecha(`${ANIO}-${mesTexto}-08`),
        purchase_conditions: 'Entrega en depósito central, pago a 30 días',
        purchase_order_status: 'RECIBIDA',
        observations: `${MARCA}: reposición mensual de insumos`,
        employees_id: empleadoStock.employees_id,
      },
    });

    const itemsOC = [
      articulos[(mes * 3) % articulos.length],
      articulos[(mes * 5 + 2) % articulos.length],
      articulos[(mes * 7 + 4) % articulos.length],
    ];
    for (const [indice, articulo] of itemsOC.entries()) {
      await tx.purchase_order_detail.create({
        data: {
          purchase_order_id: ordenCompra.purchase_order_id,
          article_id: articulo.article_id,
          item_description: articulo.article_name,
          quantity: entero(20, 90),
          unit_price: redondear(entero(600, 18000), 50),
        },
      });
      if (indice === 0) {
        await tx.purchase_order_status_history.create({
          data: {
            purchase_order_id: ordenCompra.purchase_order_id,
            previous_status: 'BORRADOR',
            new_status: 'RECIBIDA',
            changed_at: instante(`${ANIO}-${mesTexto}-08`, '09:30:00'),
            employees_id: empleadoStock.employees_id,
            reason: `${MARCA}: mercadería recibida conforme`,
          },
        });
      }
    }

    // ---- Tres comprobantes por mes --------------------------------------
    for (let posicion = 0; posicion < 3; posicion += 1) {
      const proveedor = proveedores[(mes * 3 + posicion) % proveedores.length];
      const tipo = tipoComprobantePara(proveedor, numeroComprobante);
      const diaEmision = String(4 + posicion * 9).padStart(2, '0');
      const total = redondear(entero(120000, 950000), 1000);
      numeroComprobante += 1;

      const vencimiento = sumarDias(`${ANIO}-${mesTexto}-${diaEmision}`, 30);
      const comprobante = await tx.supplier_voucher.create({
        data: {
          supplier_id: proveedor.supplier_id,
          voucher_type_id: tipo.voucher_type_id,
          voucher_point_of_sale: '0001',
          voucher_number: String(numeroComprobante),
          issue_date: fecha(`${ANIO}-${mesTexto}-${diaEmision}`),
          due_date: fecha(vencimiento),
          reception_date: instante(sumarDias(`${ANIO}-${mesTexto}-${diaEmision}`, 1), '09:15:00'),
          total_amount: total,
          employees_id: empleadoStock.employees_id,
          purchase_order_id: posicion === 0 ? ordenCompra.purchase_order_id : null,
          observations: `${MARCA}: comprobante de ${tipo.voucher_type}`,
        },
      });
      comprobantes.push({ ...comprobante, proveedor });

      // Debe en la cuenta corriente del proveedor.
      await tx.supplier_account_movement.create({
        data: {
          supplier_id: proveedor.supplier_id,
          movement_date: instante(`${ANIO}-${mesTexto}-${diaEmision}`, '09:30:00'),
          concept: `Comprobante ${tipo.voucher_type} ${comprobante.voucher_point_of_sale}-${comprobante.voucher_number}`,
          debit: total,
          credit: 0,
          voucher_id: comprobante.voucher_id,
          employees_id: empleadoStock.employees_id,
        },
      });

      // Gasto operativo sobre el segundo comprobante de cada mes.
      if (posicion === 1) {
        const asignado = redondear(total * 0.6, 1000);
        const gasto = await tx.expense.create({
          data: {
            expense_category_id: ((mes - 1) % 5) + 1,
            supplier_id: proveedor.supplier_id,
            expense_date: fecha(`${ANIO}-${mesTexto}-${diaEmision}`),
            description: `${MARCA}: ${elegir([
              'Insumos de limpieza y descartables',
              'Reposición de blancos y amenities',
              'Servicio de energía del mes',
              'Mantenimiento de instalaciones',
              'Reposición de frigobar y alimentos',
            ])} ${mesTexto}/${ANIO}`,
            expense_status: 'IMPUTADO',
            employees_id: empleadoAdmin.employees_id,
          },
        });
        await tx.expense_voucher.create({
          data: {
            expense_id: gasto.expense_id,
            voucher_id: comprobante.voucher_id,
            allocated_amount: asignado,
          },
        });
        gastos.push({ gasto, comprobante, proveedor });
      }
    }
  }

  // ---- Órdenes de pago ----------------------------------------------------
  const ordenes = [];
  for (const comprobante of comprobantes) {
    mapas.contadores.ordenPago += 1;
    const indice = mapas.contadores.ordenPago;
    const metodo = mapas.metodosPago[indice % mapas.metodosPago.length];
    const total = Number(comprobante.total_amount);
    const pagaTodo = azar(0.72);
    const aplicado = pagaTodo ? total : redondear(total * 0.5, 100);

    const emision = iso(comprobante.issue_date);
    const vencimiento = comprobante.due_date ? iso(comprobante.due_date) : sumarDias(emision, 30);
    let fechaPago = vencimiento;
    if (fechaPago > HOY) fechaPago = sumarDias(HOY, -entero(0, 4));

    const referencia = metodo.requires_reference
      ? `${metodo.payment_method === 'CHEQUE' ? 'CHQ' : metodo.payment_method === 'TARJETA' ? 'AUTH' : 'TRF'}-${ANIO}-${String(indice).padStart(4, '0')}`
      : `Caja ${String(indice).padStart(4, '0')}`;

    const orden = await tx.payment_order.create({
      data: {
        supplier_id: comprobante.proveedor.supplier_id,
        payment_method_id: metodo.payment_method_id,
        payment_date: fecha(fechaPago),
        payment_reference: `MAS-OP-${String(indice).padStart(4, '0')}`,
        payment_order_status: 0,
        observations: `${MARCA}: pago de comprobante ${comprobante.voucher_number} — ${referencia}`,
        employees_id: empleadoAdmin.employees_id,
      },
    });

    await tx.payment_order_detail.create({
      data: {
        payment_order_id: orden.payment_order_id,
        voucher_id: comprobante.voucher_id,
        applied_amount: aplicado,
      },
    });

    await tx.payment_order.update({
      where: { payment_order_id: orden.payment_order_id },
      data: {
        payment_order_status: 1,
        confirmed_date: instante(fechaPago, horaAzar(9, 16)),
      },
    });

    await tx.supplier_account_movement.create({
      data: {
        supplier_id: comprobante.proveedor.supplier_id,
        movement_date: instante(fechaPago, '10:30:00'),
        concept: `Orden de pago #${orden.payment_order_id} — ${metodo.payment_method}`,
        debit: 0,
        credit: aplicado,
        payment_order_id: orden.payment_order_id,
        employees_id: empleadoAdmin.employees_id,
      },
    });

    await tx.supplier_voucher.update({
      where: { voucher_id: comprobante.voucher_id },
      data: { paid_amount: { increment: aplicado } },
    });

    const gastoVinculado = gastos.find((fila) => fila.comprobante.voucher_id === comprobante.voucher_id);
    if (gastoVinculado) {
      await tx.expense_payment_order.create({
        data: {
          expense_id: gastoVinculado.gasto.expense_id,
          payment_order_id: orden.payment_order_id,
        },
      });
    }

    ordenes.push(orden);
  }

  return { comprobantes, gastos, ordenes };
}

/**
 * Completa la cuenta corriente de comprobantes que se hayan cargado sin su
 * movimiento de débito (por ejemplo, los del seed anterior de egresos).
 * Es idempotente: solo actúa sobre comprobantes sin movimiento de debe.
 */
async function repararCuentaCorriente(tx) {
  const pendientes = await tx.$queryRawUnsafe(`
    SELECT sv.voucher_id, sv.supplier_id, sv.issue_date, sv.total_amount,
           sv.voucher_point_of_sale, sv.voucher_number, vt.voucher_type, vt.sign
    FROM supplier_voucher sv
    JOIN voucher_type vt ON vt.voucher_type_id = sv.voucher_type_id
    WHERE vt.affects_account
      AND sv.annulled_date IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM supplier_account_movement m
        WHERE m.voucher_id = sv.voucher_id AND (m.debit > 0 OR m.credit > 0)
      )
    ORDER BY sv.issue_date
  `);

  for (const fila of pendientes) {
    const importe = Number(fila.total_amount);
    await tx.supplier_account_movement.create({
      data: {
        supplier_id: fila.supplier_id,
        movement_date: instante(iso(fila.issue_date), '09:30:00'),
        concept: `Comprobante ${fila.voucher_type} ${fila.voucher_point_of_sale}-${fila.voucher_number}`,
        debit: fila.sign >= 0 ? importe : 0,
        credit: fila.sign < 0 ? importe : 0,
        voucher_id: fila.voucher_id,
        employees_id: mapas.empleados.stock.employees_id,
      },
    });
  }

  return pendientes.length;
}

// ---------------------------------------------------------------------------
// 10. Estado final de habitaciones
// ---------------------------------------------------------------------------

async function ajustarEstadoHabitaciones(tx, reservasPorHabitacion) {
  const mantenimientos = await tx.room_maintenance.findMany({
    where: { actual_end_date: null },
  });
  const abiertos = new Map(mantenimientos.map((m) => [m.room_id, m]));

  for (const habitacion of mapas.habitaciones) {
    const reservas = reservasPorHabitacion.get(habitacion.room_id) ?? [];
    const enCasa = reservas.some((reserva) => reserva.estado === 'IN_HOUSE');
    const salioHoy = reservas.some((reserva) => reserva.estado === 'FINALIZADA' && reserva.checkOut === HOY);
    const mantenimiento = abiertos.get(habitacion.room_id);

    let estado = 'DISPONIBLE';
    if (mantenimiento) {
      estado = mantenimiento.maintenance_type === 'FUERA_DE_SERVICIO'
        ? 'FUERA_DE_SERVICIO'
        : mantenimiento.maintenance_type === 'LIMPIEZA'
          ? 'LIMPIEZA'
          : 'MANTENIMIENTO';
    } else if (enCasa) {
      estado = 'OCUPADA';
    } else if (salioHoy) {
      estado = 'LIMPIEZA';
    }

    await tx.room.update({ where: { room_id: habitacion.room_id }, data: { room_state: estado } });
  }
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

async function cargar() {
  const marcador = await prisma.hotel_parameter.findUnique({ where: { parameter_key: CLAVE_MARCADOR } });
  if (marcador) {
    console.log('La carga masiva ya fue aplicada (marcador ' + CLAVE_MARCADOR + ' = ' + marcador.parameter_value + ').');
    console.log('Para recargar desde cero, instalá la base en un esquema limpio y volvé a ejecutar el script.');
    await mostrarEstado();
    return;
  }

  console.log('Cargando datos de demostración masivos…');

  await prisma.$transaction(
    async (tx) => {
      await prepararEmpleados(tx);
      await prepararCatalogos(tx);
      const proveedores = await prepararProveedores(tx);
      await prepararTiposHabitacion(tx);
      await prepararTarifas(tx);
      await prepararHabitaciones(tx);
      const depositos = await prepararInventario(tx);
      await prepararServicios(tx);
      await prepararHuespedes(tx);
      const reservasPorHabitacion = await prepararReservas(tx);
      await prepararReservasFuturas(tx);
      await prepararMantenimientos(tx, reservasPorHabitacion);
      await prepararRetenciones(tx);
      await prepararAuditoriaReservas(tx, reservasPorHabitacion);
      await prepararMovimientosStock(tx, depositos);
      await prepararEgresos(tx, proveedores);
      await repararCuentaCorriente(tx);
      await ajustarEstadoHabitaciones(tx, reservasPorHabitacion);

      await tx.hotel_parameter.create({
        data: {
          parameter_key: CLAVE_MARCADOR,
          parameter_value: VERSION,
          description: 'Marca de la carga masiva de datos de ejemplo (seed-demo-masivo.js)',
        },
      });
    },
    { timeout: 900000, maxWait: 60000 },
  );

  console.log('Carga terminada.');
  await mostrarEstado();
}

async function mostrarEstado() {
  const tablas = [
    ['guest', 'huéspedes'],
    ['reservation', 'reservas'],
    ['reservation_payment', 'cobros de alojamiento'],
    ['room_service_charge', 'consumos de servicios'],
    ['reservation_check_in', 'check-in'],
    ['reservation_check_out', 'check-out'],
    ['reservation_stay_guest', 'acompañantes'],
    ['room_maintenance', 'mantenimientos'],
    ['room_hold', 'retenciones'],
    ['reservation_change_log', 'cambios de reserva'],
    ['reservation_web_request', 'pedidos web'],
    ['room', 'habitaciones'],
    ['room_type', 'tipos de habitación'],
    ['room_type_rate', 'tarifas'],
    ['suppliers', 'proveedores'],
    ['supplier_voucher', 'comprobantes'],
    ['purchase_order', 'órdenes de compra'],
    ['expense', 'gastos'],
    ['payment_order', 'órdenes de pago'],
    ['supplier_account_movement', 'movimientos de cuenta corriente'],
    ['stock_movement', 'movimientos de stock'],
    ['articles', 'artículos'],
  ];

  console.log('\nResumen de datos:');
  for (const [tabla, etiqueta] of tablas) {
    try {
      const filas = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS total FROM "${tabla}"`);
      console.log(`  ${etiqueta.padEnd(34)} ${String(filas[0].total).padStart(6)}`);
    } catch (error) {
      console.log(`  ${etiqueta.padEnd(34)} (no se pudo contar: ${error.message.split('\n')[0]})`);
    }
  }
}

(async () => {
  try {
    if (process.argv.includes('--estado')) {
      await mostrarEstado();
    } else if (process.argv.includes('--reparar-cuenta')) {
      await prepararEmpleados(prisma);
      const reparados = await prisma.$transaction((tx) => repararCuentaCorriente(tx));
      console.log(`Movimientos de cuenta corriente completados: ${reparados}`);
    } else if (process.argv.includes('--reset-futuras')) {
      const borrado = await prisma.$transaction((tx) => borrarReservasFuturas(tx), {
        timeout: 300000,
        maxWait: 60000,
      });
      console.log(`Reservas futuras eliminadas: ${borrado.reservas} (cobros: ${borrado.cobros}).`);
      console.log('Ejecutá `node scripts/seed-demo-masivo.js --futuras` para regenerarlas.');
      await mostrarEstado();
    } else if (process.argv.includes('--futuras')) {
      const creadas = await prisma.$transaction(
        async (tx) => {
          await cargarContextoReservas(tx);
          return prepararReservasFuturas(tx);
        },
        { timeout: 600000, maxWait: 60000 },
      );
      console.log(
        creadas
          ? `Reservas futuras generadas: ${creadas}`
          : `Las reservas futuras ya estaban cargadas (marcador ${CLAVE_MARCADOR_FUTURAS}).`,
      );
      await mostrarEstado();
    } else {
      await cargar();
    }
  } catch (error) {
    console.error('\nError al cargar los ejemplos:', error.message);
    if (error.meta) console.error(error.meta);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
