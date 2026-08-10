
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_role') THEN
        CREATE TYPE public.equipment_role AS ENUM ('dispenser', 'keg', 'other');
    END IF;
END $$;

ALTER TABLE public.order_catalog_settings 
ADD COLUMN IF NOT EXISTS equipment_role public.equipment_role,
ADD COLUMN IF NOT EXISTS tap_count integer;

-- Grant permissions (Required)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_catalog_settings TO authenticated;
GRANT ALL ON public.order_catalog_settings TO service_role;
GRANT SELECT ON public.order_catalog_settings TO anon;
