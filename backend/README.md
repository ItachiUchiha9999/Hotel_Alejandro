# Hotel Alejandro - Módulo STK (Historia STK-01)

API REST en Node.js/Express + PostgreSQL para la historia **STK-01: Registrar y administrar depósitos**.

## Criterios de aceptación cubiertos

- Registrar Nombre y Estado (Activo/Inactivo) del depósito → endpoints `POST` y `PATCH /estado`.
- El nombre del depósito no debe repetirse → `UNIQUE` en `deposit_name` (SQL) + validación 409 en la API.
- Un depósito inactivo no debe poder recibir nuevos movimientos de stock → trigger `trg_check_deposit_active` en `sql/hotel_alejandro_v1.1.sql`.

## Setup

1. Correr `sql/hotel_alejandro_v1.1.sql` contra tu base PostgreSQL (crea las tablas, datos semilla y el trigger de STK-01).
2. Copiar `.env.example` a `.env` y completar los datos de conexión.
3. Instalar dependencias:
   ```
   npm install
   ```
4. Levantar el servidor:
   ```
   npm run dev
   ```

## Endpoints - Depósitos

| Método | Ruta                        | Descripción                         |
|--------|-----------------------------|--------------------------------------|
| POST   | /api/depositos               | Crear depósito                      |
| GET    | /api/depositos                | Listar depósitos (`?activos=true`)  |
| GET    | /api/depositos/:id            | Obtener un depósito                 |
| PUT    | /api/depositos/:id            | Editar nombre/ubicación             |
| PATCH  | /api/depositos/:id/estado     | Activar/Desactivar (`{"estado":false}`) |

### Ejemplos

```bash
curl -X POST http://localhost:3000/api/depositos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Depósito Anexo", "ubicacion":"Planta Baja"}'

curl http://localhost:3000/api/depositos

curl -X PATCH http://localhost:3000/api/depositos/1/estado \
  -H "Content-Type: application/json" \
  -d '{"estado": false}'
```

Si luego se intenta crear un `Stock_Movement` con ese depósito inactivo como origen o destino, el trigger de la base rechaza el insert y la API responde `409` con el mensaje del trigger.
