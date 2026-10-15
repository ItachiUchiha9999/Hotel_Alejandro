-- Ejecutar solamente en una base nueva: DB-hotel.pgsql elimina datos existentes.
-- Uso desde la raiz: psql -U postgres -d sistema_hotelero_db -f database/instalar.sql
\set ON_ERROR_STOP on
\ir DB-hotel.pgsql
\ir 10_hu9_housekeeping.sql
\ir 17_tarifas_edicion_estado.sql
\ir 18_reservas_web.sql
\ir 19_reporte_egresos.sql
\ir 20_reserva_hora_llegada.sql
\ir 21_reserva_hora_salida.sql
\ir 22_metodo_pago_tarjeta.sql
\ir 23_rol_gerente.sql
