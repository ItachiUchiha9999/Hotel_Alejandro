# Contrato web ECO-01 / ECO-03

La interfaz pública forma parte del frontend actual y utiliza la API y las
entidades existentes. No crea reservas ni catálogos paralelos.

## ECO-01 — búsqueda

GET /api/publico/disponibilidad?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&huespedes=N

La respuesta contiene contrato (desde, hasta, huespedes, noches), total_tipos,
total_disponibles (unidades físicas disponibles) y habitaciones[] agrupadas por
tipo (tipo_id, tipo, descripcion, capacidad, cantidad_disponible, fotografias,
precio_por_noche, noches, total). No devuelve ni muestra números de habitación.
Incluye un habitacion_id candidato solo para conservar compatibilidad con la
reserva actual que asigna una habitación física. La búsqueda invoca la misma
fn_available_rooms del sistema interno. El precio sigue la tarifa vigente en la
fecha de ingreso, igual que la creación actual de reservas; la estadía multiplica
esa tarifa por las noches (la salida no cuenta como noche).

Al seleccionar un tipo, ECO-01 guarda el contrato y el identificador candidato
en sessionStorage["hotelAlejandro.seleccionECO01"]. ECO-02 puede leer este objeto
al integrarse; debe volver a validar disponibilidad y precio, y puede asignar
cualquier unidad física disponible del tipo elegido.

El modelo actual no tiene imágenes de tipos de habitación, por lo que
fotografias queda vacío y la interfaz usa un marcador visual. El catálogo de
tarifas permite vigencias y etiquetas (GENERAL, ALTA, BAJA, ESPECIAL), pero no
define intervalos de temporada distintos; se conserva la tarifa vigente al
ingreso usada por RES-05 y por la reserva existente.

## ECO-03 — consulta y cancelación

- POST /api/publico/reservas/consultar con { "codigo", "documento" }
- POST /api/publico/reservas/:codigo/cancelar con { "documento" }

La consulta solo revela la reserva si coinciden el código y el documento del
huésped. La cancelación vuelve a verificar ambos datos, bloquea la fila y
revalida el estado dentro de una transacción serializable. Solo admite
PENDIENTE y CONFIRMADA; el inventario se libera al dejar de contar la reserva
activa en la fuente compartida.

La cotización usa la política asociada a la reserva. Si la reserva no tiene una
política asignada, utiliza la política activa FLEXIBLE ya sembrada por el
esquema. La penalidad se muestra como informativa: este alcance no procesa pagos
ni cobra penalidades.

## Dependencias de ECO-02

ECO-02 debe guardar la reserva en el modelo reservation existente, asociar al
huésped real y devolver su reservation_code. Si ECO-02 permite elegir política
de cancelación, debe asignar policy_id; si no, la web aplica FLEXIBLE.
