REVOKE SELECT ON public.profiles FROM anon;
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
-- A coluna must_change_password já existe e deve ser preservada.
