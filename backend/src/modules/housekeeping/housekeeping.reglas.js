/**
 * Reglas de negocio de HU-9 (HAB-06), sin dependencias de Prisma.
 *
 * Son funciones puras: reciben datos ya resueltos y devuelven un resultado o
 * lanzan un error de negocio. Así se pueden probar sin levantar la base, y el
 * service queda a cargo solo de leer y escribir.
 */

const { invalido, conflicto, noEncontrado } = require('../../utils/AppError');

/** Tipos de bloqueo. Coinciden con el CHECK ck_maintenance_type. */
const TIPOS = ['LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];

/** Estados operativos de la habitación. Coinciden con el CHECK ck_room_status. */
const ESTADOS = ['DISPONIBLE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'];

/**
 * Una limpieza que dura más de un día no es una limpieza: es un trabajo que
 * saca la habitación de venta y tiene que registrarse como mantenimiento, para
 * que bloquee las reservas de esas fechas.
 */
const MAX_DIAS_LIMPIEZA = 1;

/** Estado al que pasa la habitación según el tipo de bloqueo. */
const ESTADO_POR_TIPO = {
  LIMPIEZA: 'LIMPIEZA',
  MANTENIMIENTO: 'MANTENIMIENTO',
  FUERA_DE_SERVICIO: 'FUERA_DE_SERVICIO',
};

/**
 * Transiciones de estado que puede provocar HU-9. Las demás las mueven otras
 * historias: DISPONIBLE -> OCUPADA la hace el check-in (RES-09), y
 * OCUPADA -> LIMPIEZA la hace el check-out (RES-11).
 */
const TRANSICIONES_HU9 = {
  DISPONIBLE: ['LIMPIEZA', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'],
  LIMPIEZA: ['DISPONIBLE', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'],
  MANTENIMIENTO: ['DISPONIBLE', 'FUERA_DE_SERVICIO'],
  FUERA_DE_SERVICIO: ['DISPONIBLE', 'MANTENIMIENTO'],
  OCUPADA: [],
};

/** Diferencia en días entre dos fechas, ignorando la hora. */
const diasEntre = (desde, hasta) => {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86400000);
};

/** Normaliza una fecha al inicio del día, para comparar sin horas. */
const soloFecha = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

/** ¿La transición de estado está permitida para HU-9? */
const puedeTransicionar = (desde, hacia) => (TRANSICIONES_HU9[desde] ?? []).includes(hacia);

/**
 * Valida que se pueda abrir un bloqueo sobre una habitación.
 *
 * @param {object} p
 * @param {object|null} p.habitacion  fila de room, o null si no existe
 * @param {string} p.tipo
 * @param {Date}   p.inicio
 * @param {Date}   p.finEstimado
 * @param {string} p.motivo
 * @param {Date}   p.hoy
 */
const validarApertura = ({ habitacion, tipo, inicio, finEstimado, motivo, hoy }) => {
  // Criterio: solo habitaciones existentes pueden marcarse.
  if (!habitacion) throw noEncontrado('La habitación no existe.');
  if (!habitacion.active) {
    throw conflicto(`La habitación ${habitacion.room_number} está dada de baja.`);
  }

  if (!TIPOS.includes(tipo)) {
    throw invalido(`El tipo de bloqueo tiene que ser uno de: ${TIPOS.join(', ')}.`);
  }

  if (!motivo || motivo.trim().length < 3) {
    throw invalido('Indicá el motivo del bloqueo.');
  }

  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) {
    throw invalido('Indicá una fecha de inicio válida.');
  }
  if (!(finEstimado instanceof Date) || Number.isNaN(finEstimado.getTime())) {
    throw invalido('Indicá una fecha de finalización estimada válida.');
  }

  const inicioDia = soloFecha(inicio);
  const finDia = soloFecha(finEstimado);
  const hoyDia = soloFecha(hoy);

  if (inicioDia < hoyDia) {
    throw invalido('El bloqueo no puede empezar en una fecha pasada.');
  }
  if (finDia < inicioDia) {
    throw invalido('La fecha de finalización no puede ser anterior a la de inicio.');
  }

  if (tipo === 'LIMPIEZA' && diasEntre(inicioDia, finDia) > MAX_DIAS_LIMPIEZA) {
    throw invalido(
      `Una limpieza no puede durar más de ${MAX_DIAS_LIMPIEZA} día. ` +
        'Si la habitación queda fuera de venta más tiempo, registralo como mantenimiento.'
    );
  }

  // Un bloqueo que ya empieza cambia el estado actual: tiene que ser una transición válida.
  const empiezaHoy = inicioDia <= hoyDia;
  if (empiezaHoy) {
    if (habitacion.room_status === 'OCUPADA') {
      throw conflicto(
        `La habitación ${habitacion.room_number} está ocupada. ` +
          'El bloqueo se puede programar para después del check-out.'
      );
    }

    const destino = ESTADO_POR_TIPO[tipo];
    if (habitacion.room_status !== destino && !puedeTransicionar(habitacion.room_status, destino)) {
      throw conflicto(
        `No se puede pasar la habitación de ${habitacion.room_status} a ${destino}.`
      );
    }
  }

  return { empiezaHoy, estadoResultante: empiezaHoy ? ESTADO_POR_TIPO[tipo] : null };
};

/**
 * Valida el cierre de un bloqueo.
 *
 * @param {object} p
 * @param {object|null} p.bloqueo  fila de room_maintenance
 * @param {Date}   p.fechaFin      fecha real de finalización
 * @param {Date}   p.hoy
 */
const validarCierre = ({ bloqueo, fechaFin, hoy }) => {
  if (!bloqueo) throw noEncontrado('El bloqueo no existe.');
  if (bloqueo.actual_end_date) throw conflicto('Este bloqueo ya fue finalizado.');

  const finDia = soloFecha(fechaFin);
  const inicioDia = soloFecha(new Date(bloqueo.start_date));

  if (finDia < inicioDia) {
    throw invalido('La fecha de finalización no puede ser anterior al inicio del bloqueo.');
  }
  if (finDia > soloFecha(hoy)) {
    throw invalido('No se puede finalizar un bloqueo con fecha futura.');
  }

  return { seAtraso: finDia > soloFecha(new Date(bloqueo.estimated_end_date)) };
};

/**
 * ¿Se puede usar la acción rápida "Marcar limpia"?
 *
 * Existe para cerrar el caso más frecuente del día: la habitación que sale del
 * check-out. El check-out la pasa a LIMPIEZA sin abrir un bloqueo, así que
 * Gobernanza necesita poder devolverla a DISPONIBLE con un solo clic.
 */
const validarMarcarLimpia = (habitacion) => {
  if (!habitacion) throw noEncontrado('La habitación no existe.');
  if (habitacion.room_status !== 'LIMPIEZA') {
    throw conflicto(
      `La habitación ${habitacion.room_number} está en ${habitacion.room_status}, no en limpieza.`
    );
  }
};

module.exports = {
  TIPOS,
  ESTADOS,
  ESTADO_POR_TIPO,
  TRANSICIONES_HU9,
  MAX_DIAS_LIMPIEZA,
  diasEntre,
  soloFecha,
  puedeTransicionar,
  validarApertura,
  validarCierre,
  validarMarcarLimpia,
};
