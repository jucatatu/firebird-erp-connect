ALTER TABLE public.order_drafts ADD COLUMN IF NOT EXISTS payload_v2 jsonb;
UPDATE public.order_drafts SET payload_v2 = payload WHERE payload_v2 IS NULL;

-- Nota: assigned_product_id no OrderEquipment (Zustand) é suficiente para a cobertura.
-- Não precisamos de tabela extra agora se o snapshot do app der conta.
