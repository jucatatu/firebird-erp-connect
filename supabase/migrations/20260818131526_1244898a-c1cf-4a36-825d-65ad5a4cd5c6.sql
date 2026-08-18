-- SPRINT 8.9.43.1.2 — MICRO-HOTFIX FINAL DE SINCRONIZAÇÃO ADMIN

-- 1. ADICIONAR COLUNA IS_SYSTEM SE NÃO EXISTIR (DEFENSIVO)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'permission_profiles' AND column_name = 'is_system') THEN
        ALTER TABLE public.permission_profiles ADD COLUMN is_system BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. GARANTIR QUE O PERFIL ADMINISTRADOR SEJA DE SISTEMA
UPDATE public.permission_profiles 
SET is_system = true 
WHERE name = 'Administrador';

-- 3. CORRIGIR admin_setup_invited_user PARA NORMALIZAÇÃO DE ROLES
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
  -- SERIALIZAÇÃO PARA EVITAR RACE CONDITIONS
  PERFORM pg_advisory_xact_lock(7142026);

  -- ALLOWLIST DE EMPRESAS (SOMENTE 1 E 3)
  IF NOT (_company_ids <@ ARRAY[1, 3]) THEN
    RAISE EXCEPTION 'INVALID_COMPANY_ACCESS: Apenas empresas 1 e 3 são permitidas.';
  END IF;

  -- VALIDAR PERFIL
  SELECT (is_system AND name = 'Administrador'), active 
  INTO _is_admin_profile, _profile_active
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PERMISSION_PROFILE: Perfil de permissão inexistente.';
  END IF;

  IF _profile_active IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_PERMISSION_PROFILE: Não é permitido atribuir um perfil inativo.';
  END IF;

  -- NORMALIZAÇÃO DE ROLES
  _final_roles := _roles;
  
  -- Se perfil é Administrador, garante role 'admin'
  IF _is_admin_profile THEN
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    -- Se NÃO é Administrador, remove role 'admin' se existir
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  -- 1. Criar perfil
  INSERT INTO public.profiles (id, full_name, permission_profile_id, erp_seller_id, active)
  VALUES (_user_id, _full_name, _permission_profile_id, _erp_seller_id, true);

  -- 2. Criar roles
  FOREACH _role IN ARRAY _final_roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role::public.app_role);
  END LOOP;

  -- 3. Criar acesso a empresas
  INSERT INTO public.user_companies (user_id, company_id)
  SELECT _user_id, unnest(_company_ids);

END;
$$;

-- 4. CORRIGIR admin_update_user PARA NORMALIZAÇÃO E LAST_ADMIN_PROTECTION SEGURO
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
  -- SERIALIZAÇÃO PARA EVITAR RACE CONDITIONS
  PERFORM pg_advisory_xact_lock(7142026);

  -- ALLOWLIST DE EMPRESAS
  IF NOT (_company_ids <@ ARRAY[1, 3]) THEN
    RAISE EXCEPTION 'INVALID_COMPANY_ACCESS: Apenas empresas 1 e 3 são permitidas.';
  END IF;

  -- VALIDAR PERFIL
  SELECT (is_system AND name = 'Administrador'), active 
  INTO _is_admin_profile, _profile_active
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PERMISSION_PROFILE: Perfil de permissão inexistente.';
  END IF;

  IF _profile_active IS NOT TRUE THEN
    RAISE EXCEPTION 'INVALID_PERMISSION_PROFILE: Perfil inativo não pode ser utilizado.';
  END IF;

  -- NORMALIZAÇÃO DE ROLES
  _final_roles := _roles;
  IF _is_admin_profile THEN
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  -- VERIFICAR SE O USUÁRIO É ATUALMENTE UM ADMIN ATIVO
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

  -- VERIFICAR SE O USUÁRIO CONTINUARÁ SENDO UM ADMIN ATIVO
  _will_be_admin := (_is_admin_profile AND _active AND ('admin' = ANY(_final_roles)));

  -- LAST_ADMIN_PROTECTION
  IF _is_currently_admin AND NOT _will_be_admin THEN
    _active_admins_count := public.count_active_admins();
    IF _active_admins_count <= 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTION: Não é permitido desativar ou remover privilégios do último administrador ativo.';
    END IF;
  END IF;

  -- PERSISTIR ALTERAÇÕES
  UPDATE public.profiles
  SET 
    full_name = _full_name,
    active = _active,
    permission_profile_id = _permission_profile_id,
    erp_seller_id = _erp_seller_id,
    updated_at = now()
  WHERE id = _target_user_id;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  FOREACH _role IN ARRAY _final_roles
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, _role::public.app_role);
  END LOOP;

  DELETE FROM public.user_companies WHERE user_id = _target_user_id;
  INSERT INTO public.user_companies (user_id, company_id)
  SELECT _target_user_id, unnest(_company_ids);

END;
$$;

-- 5. RELATÓRIO DE INVARIANTES E CORREÇÕES INICIAIS
DO $$
DECLARE
  _count_inconsistent integer;
BEGIN
  -- Adicionar role 'admin' para quem tem perfil Administrador mas não tem a role
  WITH missing_admin AS (
    SELECT p.id 
    FROM public.profiles p
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE pp.is_system = true AND pp.name = 'Administrador'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
  )
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin' FROM missing_admin;

  -- Remover role 'admin' de quem não tem perfil Administrador
  WITH extra_admin AS (
    SELECT ur.id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE ur.role = 'admin'
    AND NOT (pp.is_system = true AND pp.name = 'Administrador')
  )
  DELETE FROM public.user_roles WHERE id IN (SELECT id FROM extra_admin);

  GET DIAGNOSTICS _count_inconsistent = ROW_COUNT;
  RAISE NOTICE 'Sincronização Admin: % registros inconsistentes normalizados.', _count_inconsistent;
END $$;