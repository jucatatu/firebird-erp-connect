-- 1. ADICIONAR must_change_password EM profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'must_change_password') THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END
$$;

-- Garantir que usuários existentes não sejam afetados
UPDATE public.profiles SET must_change_password = false WHERE must_change_password IS NULL;

-- 2. RPC IDEMPOTENTE DE SETUP DE USUÁRIO
CREATE OR REPLACE FUNCTION public.admin_setup_created_user(
  _user_id uuid,
  _full_name text,
  _permission_profile_id uuid,
  _erp_seller_id integer,
  _company_ids integer[],
  _roles text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin_profile boolean;
  _profile_active boolean;
  _final_roles text[];
  _role text;
BEGIN
  -- 1. LOCK ADVISORY PARA EVITAR RACE CONDITIONS
  PERFORM pg_advisory_xact_lock(7142026);

  -- 2. VALIDAR COMPANY IDs (ALLOWLIST 1, 3 + NOT NULL + NOT EMPTY)
  IF _company_ids IS NULL 
     OR cardinality(_company_ids) = 0 
     OR EXISTS (
        SELECT 1 FROM unnest(_company_ids) AS cid WHERE cid NOT IN (1, 3)
     )
  THEN
    RAISE EXCEPTION 'Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas e pelo menos uma deve ser selecionada.'
    USING HINT = 'INVALID_COMPANY_ACCESS';
  END IF;

  -- 3. VALIDAR PERFIL
  SELECT (is_system AND name = 'Administrador'), active 
  INTO _is_admin_profile, _profile_active
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de permissão inexistente.'
    USING HINT = 'INVALID_PERMISSION_PROFILE';
  END IF;

  IF _profile_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Não é permitido atribuir um perfil inativo.'
    USING HINT = 'INVALID_PERMISSION_PROFILE';
  END IF;

  -- 4. NORMALIZAÇÃO DE ROLES
  _final_roles := _roles;
  IF _is_admin_profile THEN
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  -- 5. INSERIR OU ATUALIZAR PERFIL (IDEMPOTÊNCIA CORRIGIDA)
  INSERT INTO public.profiles (id, full_name, permission_profile_id, erp_seller_id, active, must_change_password)
  VALUES (_user_id, _full_name, _permission_profile_id, _erp_seller_id, true, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    permission_profile_id = EXCLUDED.permission_profile_id,
    erp_seller_id = EXCLUDED.erp_seller_id,
    active = true,
    must_change_password = true,
    updated_at = now();

  -- 6. ATUALIZAR ROLES (LIMPAR E INSERIR)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  FOREACH _role IN ARRAY _final_roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role::public.app_role);
  END LOOP;

  -- 7. ATUALIZAR ACESSO A EMPRESAS (LIMPAR E INSERIR)
  DELETE FROM public.user_company_access WHERE user_id = _user_id;
  INSERT INTO public.user_company_access (user_id, company_id)
  SELECT _user_id, unnest(_company_ids);

END;
$$;

-- 3. RPC PARA LIMPAR FLAG DE TROCA DE SENHA
CREATE OR REPLACE FUNCTION public.complete_initial_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas o próprio usuário pode limpar seu flag
  UPDATE public.profiles 
  SET must_change_password = false,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- 4. GRANTS
REVOKE EXECUTE ON FUNCTION public.admin_setup_created_user(uuid, text, uuid, integer, integer[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_setup_created_user(uuid, text, uuid, integer, integer[], text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_created_user(uuid, text, uuid, integer, integer[], text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_initial_password_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_password_change() TO authenticated;
