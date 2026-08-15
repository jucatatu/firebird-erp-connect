-- Migration: SPRINT 8.9.41 — PAGINAÇÃO SERVER-SIDE + IDENTIFICADOR SEQUENCIAL APP-0001

-- 1. Create a sequence for the application order numbers
CREATE SEQUENCE IF NOT EXISTS public.order_drafts_app_order_number_seq;

-- 2. Add the column as nullable first to allow backfill
ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS app_order_number BIGINT UNIQUE;

-- 3. Backfill existing records in chronological order
WITH backfill AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) as seq_num
  FROM public.order_drafts
  WHERE app_order_number IS NULL
)
UPDATE public.order_drafts
SET app_order_number = backfill.seq_num
FROM backfill
WHERE public.order_drafts.id = backfill.id;

-- 4. Adjust the sequence to start AFTER the backfilled numbers
DO $$
DECLARE
  max_num BIGINT;
BEGIN
  SELECT COALESCE(MAX(app_order_number), 0) INTO max_num FROM public.order_drafts;
  EXECUTE 'ALTER SEQUENCE public.order_drafts_app_order_number_seq RESTART WITH ' || (max_num + 1);
END $$;

-- 5. Set default value for new records using the sequence
ALTER TABLE public.order_drafts ALTER COLUMN app_order_number SET DEFAULT nextval('public.order_drafts_app_order_number_seq');

-- 6. Set column as NOT NULL now that backfill is complete
ALTER TABLE public.order_drafts ALTER COLUMN app_order_number SET NOT NULL;

-- 7. Grant sequence usage to appropriate roles
GRANT USAGE, SELECT ON SEQUENCE public.order_drafts_app_order_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.order_drafts_app_order_number_seq TO service_role;
