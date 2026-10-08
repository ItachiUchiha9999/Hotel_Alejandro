-- Ejecutar solamente en una base nueva: DB-hotel.pgsql elimina datos existentes.
-- Uso desde la raiz: psql -U postgres -d sistema_hotelero_db -f database/instalar.sql
\set ON_ERROR_STOP on
\ir DB-hotel.pgsql
\ir 10_hu9_housekeeping.sql
\ir 17_tarifas_edicion_estado.sql
\ir 18_reservas_web.sql
\ir 19_reporte_egresos.sql
