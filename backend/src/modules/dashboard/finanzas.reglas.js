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

function generarSerieAnual(inicio, movimientos, hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  const porMes = new Map();
  for (const movimiento of movimientos) {
    const mes = movimiento.fecha.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(movimiento);
  }
  return Array.from({ length: 12 }, (_, mes) => {
    const fecha = new Date(Date.UTC(inicio.getUTCFullYear(), mes, 1)).toISOString().slice(0, 10);
    const filas = porMes.get(fecha.slice(0, 7)) ?? [];
    return { fecha, ...calcularTotales(filas), pendiente: fecha.slice(0, 7) > hoy.slice(0, 7) && filas.length === 0 };
  });
}

module.exports = { calcularTotales, generarSerie, generarSerieAnual };