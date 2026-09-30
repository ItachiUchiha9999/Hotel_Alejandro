-- Clasifica cada tarifa por temporada. La vigencia sigue siendo un rango
-- consecutivo: al cargar el próximo cambio, el trigger cierra la tarifa previa.
ALTER TABLE "room_type_rate"
  ADD COLUMN IF NOT EXISTS season_name VARCHAR(60) NOT NULL DEFAULT 'GENERAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_rate_season_name'
      AND conrelid = 'room_type_rate'::regclass
  ) THEN
    ALTER TABLE "room_type_rate"
      ADD CONSTRAINT ck_rate_season_name
      CHECK (season_name IN ('GENERAL', 'ALTA', 'BAJA', 'ESPECIAL'));
  END IF;
END $$;
