-- SPRINT 8.9.8: Adição do tipo logístico ao catálogo operacional
-- draft = chopp a granel (exige barril)
-- packaged = produto sem equipamento obrigatório (exige nada)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'logistics_type') THEN
        CREATE TYPE public.logistics_type AS ENUM ('draft', 'packaged');
    END IF;
END$$;

ALTER TABLE public.order_catalog_settings 
ADD COLUMN IF NOT EXISTS logistics_type public.logistics_type;

COMMENT ON COLUMN public.order_catalog_settings.logistics_type IS 'draft = exige barril; packaged = sem equipamento obrigatório';

-- Migração segura: inferir tipo inicial baseado no snapshot para itens existentes
UPDATE public.order_catalog_settings
SET logistics_type = 'draft'
WHERE item_type = 'product'
  AND erp_description_snapshot ILIKE '%CHOPP%'
  AND erp_description_snapshot NOT ILIKE '%GROWLER%'
  AND erp_description_snapshot NOT ILIKE '%GARRAFA%'
  AND erp_description_snapshot NOT ILIKE '%LATA%';

UPDATE public.order_catalog_settings
SET logistics_type = 'packaged'
WHERE item_type = 'product'
  AND (
    erp_description_snapshot ILIKE '%GROWLER%' OR
    erp_description_snapshot ILIKE '%GARRAFA%' OR
    erp_description_snapshot ILIKE '%LATA%' OR
    erp_description_snapshot NOT ILIKE '%CHOPP%'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_catalog_settings TO authenticated;
GRANT ALL ON public.order_catalog_settings TO service_role;
