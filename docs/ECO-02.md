# ECO-02 — Reserva desde el sitio web

ECO-01 redirige a `/web/reservar` con la selección guardada en sessionStorage.
El formulario pide nombre, apellido, tipo y número de documento, correo y teléfono.
No requiere una cuenta. El backend vuelve a consultar la disponibilidad y la tarifa:
si cambió el precio, solicita repetir la búsqueda antes de crear la reserva.

`POST /api/publico/reservas` recibe `requestId` (UUID v4), `nombre`, `apellido`,
`tipoDocumento`, `documento`, `email`, `telefono`, `desde`, `hasta`, `tipoId`,
`huespedes` y `precioEsperado` (precio por noche visto en ECO-01).

El servidor asigna una unidad disponible del tipo elegido. Guarda la reserva en
`reservation`, con estado `PENDIENTE`, origen `WEB` (Sitio web), política FLEXIBLE
y vencimiento a las 24 horas, igual que las pendientes administrativas.
La cantidad de huéspedes se registra como adultos porque ECO-01 no diferencia edades.
El check-in permite registrar el desglose real existente.

Si coincide el tipo y número de documento, usa el cliente activo existente sin
sobrescribir sus datos personales. El correo y teléfono ingresados quedan asociados
a esta solicitud; la confirmación se envía al correo ingresado. Si no existe perfil,
lo crea en la misma transacción que la reserva. No expone datos previos del cliente.

Los reintentos de la misma solicitud devuelven el mismo código. Una solicitud con
el mismo identificador y otros datos se rechaza. La transacción serializable,
los bloqueos y la exclusión de solapamientos de PostgreSQL protegen la disponibilidad.

## Instalación en una base existente

Ejecutar `database/18_reservas_web.sql` en pgAdmin conectado a la base del proyecto.
Es incremental y conserva los datos. Las bases nuevas lo incluyen en `instalar.sql`.
También puede aplicarse desde backend con `node scripts/instalar-eco2.js`.
La tabla auxiliar se accede con SQL parametrizado; no requiere regenerar Prisma.
Desde backend ejecutar `npm install` y reiniciar el servidor.

## Correo

Configurar en `backend/.env`:

```env
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Hotel Alejandro I <reservas@tu-dominio.com>"
PUBLIC_WEB_URL=http://localhost:3000
```

Para puerto 465 usar `SMTP_SECURE=true`. Nunca subir credenciales al repositorio.
La configuración sigue el [transporte SMTP de Nodemailer](https://nodemailer.com/smtp).
Para pruebas sin destinatarios reales puede usarse un capturador SMTP local en
127.0.0.1:1025, sin autenticación, con un remitente de prueba.

La confirmación y el trabajo de envío se guardan juntos en `reservation_web_request`.
El servidor procesa la cola cada 10 segundos, hasta cinco correos por pasada.
Un error SMTP programa otro intento cinco minutos después. Sin SMTP_HOST o MAIL_FROM,
los trabajos quedan pendientes. La pantalla siempre muestra el código y distingue
correo pendiente de enviado; no afirma que se entregó un correo sin comprobarlo.
SMTP aceptado no garantiza llegada a la bandeja de entrada. Si el proceso se interrumpe
después de enviar y antes de registrar el envío, el reintento podría duplicar el correo,
pero nunca duplica la reserva.

## Validación

`npm test` incluye validaciones de formulario y contenido de correo, sin envíos reales.
`node scripts/probar-eco2.js` instala una base temporal, prueba el flujo contra PostgreSQL
y elimina exclusivamente esa base de prueba al terminar. Requiere permisos para crear
bases y psql (en Windows usa PostgreSQL 17; se puede ajustar con PSQL_PATH).
La prueba captura correo con un servidor SMTP local y verifica fallo, reintento y envío,
sin enviar mensajes a personas reales.

Recorrido manual: buscar en `/web`, elegir tipo, completar datos y registrar. Verificar
el estado Pendiente en recepción; consultar y cancelar usando código y documento en
`/web/consulta`; repetir la búsqueda para comprobar que se liberó disponibilidad.
