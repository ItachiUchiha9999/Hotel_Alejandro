/**
 * Pruebas de HU-9 (HAB-06). Lógica pura: no necesitan base de datos.
 *
 *   npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  puedeTransicionar,
  validarApertura,
  validarCierre,
  validarMarcarLimpia,
} = require('../src/modules/housekeeping/housekeeping.reglas');

const HOY = new Date(2026, 8, 20); // 20/09/2026
const MANANA = new Date(2026, 8, 21);
const PASADO = new Date(2026, 8, 22);
const AYER = new Date(2026, 8, 19);
const EN_UNA_SEMANA = new Date(2026, 8, 27);

const habitacion = (estado = 'DISPONIBLE', extra = {}) => ({
  room_id: 1,
  room_number: '101',
  active: true,
  room_status: estado,
  ...extra,
});

const apertura = (extra = {}) => ({
  habitacion: habitacion(),
  tipo: 'MANTENIMIENTO',
  inicio: HOY,
  finEstimado: MANANA,
  motivo: 'Pérdida en la canilla del baño',
  hoy: HOY,
  ...extra,
});

// ---------------------------------------------------------------------------
// Criterio: solo habitaciones existentes pueden marcarse
// ---------------------------------------------------------------------------

test('no se puede bloquear una habitación que no existe', () => {
  assert.throws(() => validarApertura(apertura({ habitacion: null })), /no existe/);
});

test('no se puede bloquear una habitación dada de baja', () => {
  assert.throws(
    () => validarApertura(apertura({ habitacion: habitacion('DISPONIBLE', { active: false }) })),
    /dada de baja/
  );
});

// ---------------------------------------------------------------------------
// Ciclo de estados
// ---------------------------------------------------------------------------

test('una habitación ocupada no se puede bloquear desde hoy', () => {
  assert.throws(
    () => validarApertura(apertura({ habitacion: habitacion('OCUPADA') })),
    /está ocupada/
  );
});

test('una habitación ocupada sí admite un bloqueo programado para después', () => {
  const r = validarApertura(
    apertura({ habitacion: habitacion('OCUPADA'), inicio: EN_UNA_SEMANA, finEstimado: EN_UNA_SEMANA })
  );
  assert.equal(r.empiezaHoy, false);
  assert.equal(r.estadoResultante, null);
});

test('un bloqueo que empieza hoy cambia el estado de la habitación', () => {
  const r = validarApertura(apertura());
  assert.equal(r.empiezaHoy, true);
  assert.equal(r.estadoResultante, 'MANTENIMIENTO');
});

test('un bloqueo programado a futuro no cambia el estado actual', () => {
  const r = validarApertura(apertura({ inicio: EN_UNA_SEMANA, finEstimado: EN_UNA_SEMANA }));
  assert.equal(r.empiezaHoy, false);
  assert.equal(r.estadoResultante, null);
});

test('desde LIMPIEZA se puede pasar a MANTENIMIENTO si aparece un desperfecto', () => {
  assert.equal(puedeTransicionar('LIMPIEZA', 'MANTENIMIENTO'), true);
});

test('HU-9 no puede mover una habitación ocupada: lo hace el check-out', () => {
  assert.equal(puedeTransicionar('OCUPADA', 'LIMPIEZA'), false);
  assert.equal(puedeTransicionar('OCUPADA', 'DISPONIBLE'), false);
});

test('HU-9 no puede pasar una habitación a OCUPADA: lo hace el check-in', () => {
  assert.equal(puedeTransicionar('DISPONIBLE', 'OCUPADA'), false);
});

// ---------------------------------------------------------------------------
// Fechas y motivo
// ---------------------------------------------------------------------------

test('el bloqueo no puede empezar en el pasado', () => {
  assert.throws(() => validarApertura(apertura({ inicio: AYER })), /fecha pasada/);
});

test('la finalización estimada no puede ser anterior al inicio', () => {
  assert.throws(
    () => validarApertura(apertura({ inicio: PASADO, finEstimado: MANANA })),
    /anterior a la de inicio/
  );
});

test('el motivo es obligatorio', () => {
  assert.throws(() => validarApertura(apertura({ motivo: '' })), /motivo/);
  assert.throws(() => validarApertura(apertura({ motivo: 'x' })), /motivo/);
});

test('el tipo tiene que ser uno de los habilitados', () => {
  assert.throws(() => validarApertura(apertura({ tipo: 'PINTURA' })), /tiene que ser uno de/);
});

test('una limpieza de más de un día se rechaza: es un mantenimiento', () => {
  assert.throws(
    () => validarApertura(apertura({ tipo: 'LIMPIEZA', finEstimado: EN_UNA_SEMANA })),
    /no puede durar más/
  );
});

test('una limpieza de hasta un día es válida', () => {
  assert.doesNotThrow(() => validarApertura(apertura({ tipo: 'LIMPIEZA', finEstimado: MANANA })));
});

// ---------------------------------------------------------------------------
// Criterio: transición a Disponible al finalizar
// ---------------------------------------------------------------------------

const bloqueoAbierto = {
  maintenance_id: 5,
  start_date: AYER,
  estimated_end_date: HOY,
  actual_end_date: null,
};

test('se puede finalizar un bloqueo abierto', () => {
  const r = validarCierre({ bloqueo: bloqueoAbierto, fechaFin: HOY, hoy: HOY });
  assert.equal(r.seAtraso, false);
});

test('se detecta cuando el cierre se atrasó respecto de lo estimado', () => {
  const r = validarCierre({
    bloqueo: { ...bloqueoAbierto, estimated_end_date: AYER },
    fechaFin: HOY,
    hoy: HOY,
  });
  assert.equal(r.seAtraso, true);
});

test('un bloqueo ya finalizado no se vuelve a cerrar', () => {
  assert.throws(
    () => validarCierre({ bloqueo: { ...bloqueoAbierto, actual_end_date: HOY }, fechaFin: HOY, hoy: HOY }),
    /ya fue finalizado/
  );
});

test('no se puede finalizar con fecha futura', () => {
  assert.throws(
    () => validarCierre({ bloqueo: bloqueoAbierto, fechaFin: MANANA, hoy: HOY }),
    /fecha futura/
  );
});

test('la fecha de cierre no puede ser anterior al inicio', () => {
  assert.throws(
    () => validarCierre({ bloqueo: { ...bloqueoAbierto, start_date: HOY }, fechaFin: AYER, hoy: HOY }),
    /anterior al inicio/
  );
});

// ---------------------------------------------------------------------------
// Acción rápida "Marcar limpia"
// ---------------------------------------------------------------------------

test('"Marcar limpia" funciona sobre una habitación en limpieza', () => {
  assert.doesNotThrow(() => validarMarcarLimpia(habitacion('LIMPIEZA')));
});

test('"Marcar limpia" se rechaza si la habitación no está en limpieza', () => {
  assert.throws(() => validarMarcarLimpia(habitacion('DISPONIBLE')), /no en limpieza/);
  assert.throws(() => validarMarcarLimpia(habitacion('MANTENIMIENTO')), /no en limpieza/);
});
