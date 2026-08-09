-- Create operational enums if they don't exist
DO $$ BEGIN
    CREATE TYPE public.equipment_mode AS ENUM ('CHOPE', 'NONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.equipment_role AS ENUM ('TAP', 'KEG', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add operational columns to order_catalog_settings
ALTER TABLE public.order_catalog_settings 
ADD COLUMN IF NOT EXISTS requires_equipment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS equipment_mode public.equipment_mode DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS equipment_role public.equipment_role DEFAULT 'OTHER',
ADD COLUMN IF NOT EXISTS tap_lines integer,
ADD COLUMN IF NOT EXISTS capacity_liters integer;

-- Update existing data based on heuristics as a starting point
UPDATE public.order_catalog_settings 
SET equipment_mode = 'CHOPE', requires_equipment = true 
WHERE item_type = 'product' 
  AND (erp_description_snapshot ILIKE '%CHOPP%' 
       AND erp_description_snapshot NOT ILIKE '%GROWLER%' 
       AND erp_description_snapshot NOT ILIKE '%GARRAFA%');

UPDATE public.order_catalog_settings 
SET equipment_role = 'TAP', tap_lines = 1 
WHERE item_type = 'equipment' AND erp_description_snapshot ILIKE '%CHOPEIRA%' AND erp_description_snapshot ILIKE '%1 VIA%';

UPDATE public.order_catalog_settings 
SET equipment_role = 'TAP', tap_lines = 2 
WHERE item_type = 'equipment' AND erp_description_snapshot ILIKE '%CHOPEIRA%' AND erp_description_snapshot ILIKE '%2 VIAS%';

UPDATE public.order_catalog_settings 
SET equipment_role = 'KEG', capacity_liters = 10 
WHERE item_type = 'equipment' AND erp_description_snapshot ILIKE '%BARRIL%' AND erp_description_snapshot ILIKE '%10L%';

UPDATE public.order_catalog_settings 
SET equipment_role = 'KEG', capacity_liters = 30 
WHERE item_type = 'equipment' AND erp_description_snapshot ILIKE '%BARRIL%' AND erp_description_snapshot ILIKE '%30L%';

UPDATE public.order_catalog_settings 
SET equipment_role = 'KEG', capacity_liters = 50 
WHERE item_type = 'equipment' AND erp_description_snapshot ILIKE '%BARRIL%' AND erp_description_snapshot ILIKE '%50L%';

-- Ensure proper grants are maintained (though columns are added to existing table)
GRANT SELECT ON public.order_catalog_settings TO authenticated;
