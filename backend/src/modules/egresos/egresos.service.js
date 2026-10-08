const { validarFiltros, generarReporte } = require('./egresos.reglas');
const fuente = require('./egresos.fuente');

async function consultar(filtros) {
  const seleccion = validarFiltros(filtros);
  const filas = await fuente.consultar(seleccion.desde, seleccion.hasta);
  return generarReporte(seleccion, filas);
}

module.exports = { consultar };