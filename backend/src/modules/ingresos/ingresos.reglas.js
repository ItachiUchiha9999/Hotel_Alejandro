const { invalido } = require('../../utils/AppError');
const DIA = 86400000;
const ORIGENES = [
  { id: 'RESERVAS', nombre: 'Reservas / alojamiento' },
  { id: 'SERVICIOS', nombre: 'Servicios' },
  { id: 'CONSUMOS', nombre: 'Consumos' },
];
const textoFecha = fecha => fecha.toISOString().slice(0, 10);
const hoyArgentina = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function fechaValida(valor, nombre) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw invalido(`La fecha ${nombre} debe tener formato AAAA-MM-DD.`);
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || textoFecha(fecha) !== valor) throw invalido(`La fecha ${nombre} no es válida.`);
  return fecha;
}

function validarFiltros({ desde, hasta, agrupacion = 'MES' } = {}) {
  const hoy = hoyArgentina();
  const inicio = fechaValida(desde ?? `${hoy.slice(0, 4)}-01-01`, 'desde');
  const fin = fechaValida(hasta ?? hoy, 'hasta');
  if (inicio > fin) throw invalido('La fecha desde no puede ser posterior a la fecha hasta.');
  if (fin - inicio > 1830 * DIA) throw invalido('Seleccioná un período de hasta cinco años.');
  const modo = typeof agrupacion === 'string' ? agrupacion.toUpperCase() : '';
  if (!['MES', 'SEMANA'].includes(modo)) throw invalido('La agrupación debe ser MES o SEMANA.');
  const dias = (fin - inicio) / DIA + 1;
  return { desde: textoFecha(inicio), hasta: textoFecha(fin), agrupacion: modo,
    anterior_desde: textoFecha(new Date(inicio.getTime() - dias * DIA)),
    anterior_hasta: textoFecha(new Date(inicio.getTime() - DIA)), dias };
}

function inicioGrupo(fecha, modo) {
  const inicio = new Date(`${fecha}T00:00:00Z`);
  if (modo === 'MES') inicio.setUTCDate(1);
  else inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7));
  return inicio;
}
const centavos = importe => Math.round(Number(importe) * 100);

function generarReporte(filtros, filas) {
  const grupos = new Map();
  const inicio = new Date(`${filtros.desde}T00:00:00Z`);
  const fin = new Date(`${filtros.hasta}T00:00:00Z`);
  let cursor = inicioGrupo(filtros.desde, filtros.agrupacion);
  while (cursor <= fin) {
    const siguiente = new Date(cursor);
    if (filtros.agrupacion === 'MES') siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
    else siguiente.setUTCDate(siguiente.getUTCDate() + 7);
    grupos.set(textoFecha(cursor), { inicio: textoFecha(cursor),
      desde: textoFecha(new Date(Math.max(cursor, inicio))), hasta: textoFecha(new Date(Math.min(siguiente.getTime() - DIA, fin))),
      origenes: { RESERVAS: 0, SERVICIOS: 0, CONSUMOS: 0 } });
    cursor = siguiente;
  }
  const origenes = { RESERVAS: 0, SERVICIOS: 0, CONSUMOS: 0 };
  const movimientos = [];
  let anterior = 0;
  for (const fila of filas) {
    const importe = centavos(fila.importe);
    if (!Object.hasOwn(origenes, fila.origen) || !Number.isFinite(importe) || importe <= 0) continue;
    if (fila.fecha >= filtros.anterior_desde && fila.fecha <= filtros.anterior_hasta) { anterior += importe; continue; }
    if (fila.fecha < filtros.desde || fila.fecha > filtros.hasta) continue;
    const grupo = grupos.get(textoFecha(inicioGrupo(fila.fecha, filtros.agrupacion)));
    if (!grupo) continue;
    grupo.origenes[fila.origen] += importe; origenes[fila.origen] += importe;
    movimientos.push({ ...fila, importe: importe / 100 });
  }
  let acumulado = 0;
  const serie = [...grupos.values()].map(grupo => {
    const total = Object.values(grupo.origenes).reduce((sum, valor) => sum + valor, 0);
    acumulado += total;
    return { ...grupo, origenes: Object.fromEntries(Object.entries(grupo.origenes).map(([id, valor]) => [id, valor / 100])), total: total / 100, acumulado: acumulado / 100 };
  });
  const total = Object.values(origenes).reduce((sum, valor) => sum + valor, 0);
  return { desde: filtros.desde, hasta: filtros.hasta, agrupacion: filtros.agrupacion, total: total / 100,
    cantidad_cobros: movimientos.length, moneda: 'ARS',
    comparacion: { desde: filtros.anterior_desde, hasta: filtros.anterior_hasta, dias: filtros.dias, total: anterior / 100,
      diferencia: (total - anterior) / 100, variacion_porcentual: anterior ? (total - anterior) / anterior * 100 : total ? null : 0 },
    origenes: ORIGENES.map(origen => ({ ...origen, importe: origenes[origen.id] / 100 })), serie,
    movimientos: movimientos.sort((a,b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id)) };
}

module.exports = { validarFiltros, generarReporte };
