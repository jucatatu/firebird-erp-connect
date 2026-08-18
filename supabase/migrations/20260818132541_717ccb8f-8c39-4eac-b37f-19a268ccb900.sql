CREATE TABLE IF NOT EXISTS public.user_company_access (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id smallint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_company_access TO authenticated;
GRANT ALL ON public.user_company_access TO service_role;

-- Rodar a migration de correção de RPCs
DO $$
BEGIN
  -- Se a tabela user_companies existir por engano, migrar dados e remover
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_companies') THEN
    INSERT INTO public.user_company_access (user_id, company_id)
    SELECT user_id, company_id FROM public.user_companies
    ON CONFLICT DO NOTHING;
    DROP TABLE public.user_companies;
  END IF;
END $$;
