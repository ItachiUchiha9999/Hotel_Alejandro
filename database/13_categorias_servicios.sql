-- Clasificación para el catálogo de servicios de habitación.
BEGIN;

ALTER TABLE Room_Service_Catalog
    ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'OTROS';

UPDATE Room_Service_Catalog
SET category = CASE
    WHEN service_name ILIKE '%minibar%' OR service_name ILIKE '%agua mineral%'
      OR service_name ILIKE '%gaseosa%' OR service_name ILIKE '%snack%'
      OR service_name ILIKE '%chocolate%' THEN 'MINIBAR'
    WHEN service_name ILIKE '%desayun%' OR service_name ILIKE '%gastronom%' THEN 'GASTRONOMIA'
    WHEN service_name ILIKE '%lavander%' OR service_name ILIKE '%planchad%' THEN 'LAVANDERIA'
    WHEN service_name ILIKE '%estacionamiento%' OR service_name ILIKE '%cochera%' THEN 'ESTACIONAMIENTO'
    WHEN service_name ILIKE '%limpieza%' THEN 'LIMPIEZA'
    WHEN service_name ILIKE '%transporte%' OR service_name ILIKE '%traslado%' THEN 'TRANSPORTE'
    ELSE 'OTROS'
END
WHERE category = 'OTROS';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_room_service_category'
          AND conrelid = 'room_service_catalog'::regclass
    ) THEN
        ALTER TABLE Room_Service_Catalog
            ADD CONSTRAINT ck_room_service_category
            CHECK (category IN ('MINIBAR', 'GASTRONOMIA', 'LAVANDERIA', 'ESTACIONAMIENTO', 'LIMPIEZA', 'TRANSPORTE', 'OTROS'));
    END IF;
END $$;

COMMIT;
