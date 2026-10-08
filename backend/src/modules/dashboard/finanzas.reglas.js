const centavos = importe => Math.round(Number(importe) * 100);

const margenDe = (ingresos, resultado) => ingresos === 0 ? null : resultado / ingresos * 100;

function calcularTotales(movimientos) {
  const importes = movimientos.reduce((totales, movimiento) => {
    if (movimiento.tipo === 'INGRESO') totales.ingresos += centavos(movimiento.importe);
    else totales.egresos += centavos(movimiento.importe);
    return totales;
  }, { ingresos: 0, egresos: 0 });
  const resultado = importes.ingresos - importes.egresos;
  return {
    ingresos: importes.ingresos / 100,
    egresos: importes.egresos / 100,
    neto: resultado / 100,
    margen_porcentual: margenDe(importes.ingresos, resultado),
  };
}

function generarSerie(inicio, dias, movimientos) {
  const porFecha = new Map();
  for (const movimiento of movimientos) {
    if (!porFecha.has(movimiento.fecha)) porFecha.set(movimiento.fecha, { ingresos: 0, egresos: 0 });
    const dia = porFecha.get(movimiento.fecha);
    dia[movimiento.tipo === 'INGRESO' ? 'ingresos' : 'egresos'] += centavos(movimiento.importe);
  }

  return Array.from({ length: dias }, (_, indice) => {
    const fecha = new Date(inicio);
    fecha.setUTCDate(fecha.getUTCDate() + indice);
    const fechaISO = fecha.toISOString().slice(0, 10);
    const importes = porFecha.get(fechaISO) ?? { ingresos: 0, egresos: 0 };
    const resultado = importes.ingresos - importes.egresos;
    return {
      fecha: fechaISO,
      ingresos: importes.ingresos / 100,
      egresos: importes.egresos / 100,
      neto: resultado / 100,
      margen_porcentual: margenDe(importes.ingresos, resultado),
    };
  });
}

module.exports = { calcularTotales, generarSerie };