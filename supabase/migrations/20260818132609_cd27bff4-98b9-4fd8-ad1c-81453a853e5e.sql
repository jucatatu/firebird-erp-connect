-- APLICAÇÃO FINAL DAS RPCs CORRETAS (SPRINT 8.9.43.1.3)
-- 1. admin_setup_invited_user
CREATE OR REPLACE FUNCTION public.admin_setup_invited_user(
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
  -- 1. LOCK ADVISORY
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

  -- 5. INSERIR PERFIL
  INSERT INTO public.profiles (id, full_name, permission_profile_id, erp_seller_id, active)
  VALUES (_user_id, _full_name, _permission_profile_id, _erp_seller_id, true);

  -- 6. INSERIR ROLES
  FOREACH _role IN ARRAY _final_roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role::public.app_role);
  END LOOP;

  -- 7. INSERIR ACESSO A EMPRESAS (TABELA CORRETA: user_company_access)
  INSERT INTO public.user_company_access (user_id, company_id)
  SELECT _user_id, unnest(_company_ids);

END;
$$;

-- 2. admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _target_user_id uuid,
  _full_name text,
  _active boolean,
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
  _active_admins_count integer;
  _is_currently_admin boolean;
  _will_be_admin boolean;
  _role text;
BEGIN
  -- 1. LOCK ADVISORY
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
    RAISE EXCEPTION 'Perfil inativo não pode ser utilizado.'
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

  -- 5. IDENTIFICAR ESTADO ADMINISTRATIVO ATUAL
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE p.id = _target_user_id
    AND p.active = true
    AND ur.role = 'admin'
    AND pp.is_system = true
    AND pp.name = 'Administrador'
  ) INTO _is_currently_admin;

  -- 6. CALCULAR ESTADO FUTURO
  _will_be_admin := (_is_admin_profile AND _active AND ('admin' = ANY(_final_roles)));

  -- 7. APLICAR LAST_ADMIN_PROTECTION
  IF _is_currently_admin AND NOT _will_be_admin THEN
    _active_admins_count := public.count_active_admins();
    IF _active_admins_count <= 1 THEN
      RAISE EXCEPTION 'Não é permitido desativar ou remover privilégios do último administrador ativo.'
      USING HINT = 'LAST_ADMIN_PROTECTION';
    END IF;
  END IF;

  -- 8. ATUALIZAR PROFILES
  UPDATE public.profiles
  SET 
    full_name = _full_name,
    active = _active,
    permission_profile_id = _permission_profile_id,
    erp_seller_id = _erp_seller_id,
    updated_at = now()
  WHERE id = _target_user_id;

  -- 9. ATUALIZAR ROLES
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  FOREACH _role IN ARRAY _final_roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, _role::public.app_role);
  END LOOP;

  -- 10. ATUALIZAR EMPRESAS (TABELA CORRETA: user_company_access)
  DELETE FROM public.user_company_access WHERE user_id = _target_user_id;
  INSERT INTO public.user_company_access (user_id, company_id)
  SELECT _target_user_id, unnest(_company_ids);

END;
$$;

-- 3. REVOKE/GRANT SEGURO (RESOLVE ALERTAS DO LINTER)
REVOKE EXECUTE ON FUNCTION public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]) TO service_role;
