
UPDATE public.order_catalog_settings SET equipment_role = 'keg' WHERE erp_description_snapshot LIKE 'BARRIL%';
UPDATE public.order_catalog_settings SET equipment_role = 'dispenser', tap_count = 1 WHERE erp_description_snapshot LIKE '%1 VIA%';
UPDATE public.order_catalog_settings SET equipment_role = 'dispenser', tap_count = 2 WHERE erp_description_snapshot LIKE '%2 VIA%';
UPDATE public.order_catalog_settings SET equipment_role = 'dispenser', tap_count = 3 WHERE erp_description_snapshot LIKE '%3 VIA%';
UPDATE public.order_catalog_settings SET equipment_role = 'dispenser', tap_count = 1 WHERE erp_description_snapshot = 'CHOPEIRA ELETRICA 90L/H';
