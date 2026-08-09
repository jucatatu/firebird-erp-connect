-- Migração para mapeamento de vendedores e persistência de idempotência
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS erp_seller_id integer;
ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS erp_order_id integer;
ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS erp_order_number integer;

-- A tabela order_drafts já deve ter idempotency_key de uma sprint anterior, mas garantimos os campos de estado
ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS submission_status text DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitting', 'created', 'unknown', 'failed'));
ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone;

-- Grants necessários (re-aplicando para garantir acesso aos novos campos)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_drafts TO authenticated;
GRANT ALL ON public.order_drafts TO service_role;
