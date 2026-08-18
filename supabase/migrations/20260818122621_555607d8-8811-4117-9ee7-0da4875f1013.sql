DROP FUNCTION IF EXISTS public.count_active_admins();

CREATE OR REPLACE FUNCTION public.count_active_admins()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
  WHERE p.active = true 
    AND ur.role = 'admin'
    AND pp.name = 'Administrador'
    AND pp.is_system = true;
$$;

-- 2. RPC Transacional para Atualização de Usuário (Atomicidade Garantida)
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
  _is_target_admin boolean;
  _new_profile_name text;
  _new_profile_is_system boolean;
  _admins_count integer;
  _final_roles text[];
BEGIN
  -- 1. Verificar se o alvo é um admin ATUAL
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE p.id = _target_user_id 
      AND p.active = true
      AND ur.role = 'admin'
      AND pp.name = 'Administrador'
      AND pp.is_system = true
  ) INTO _is_target_admin;

  -- 2. Verificar o novo perfil
  SELECT name, is_system INTO _new_profile_name, _new_profile_is_system
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  -- 3. Sincronização Obrigatória Perfil Administrador <=> role admin
  _final_roles := _roles;
  IF _new_profile_name = 'Administrador' AND _new_profile_is_system = true THEN
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  -- 4. Proteção do Último Admin
  IF _is_target_admin AND (_active = false OR NOT ('admin' = ANY(_final_roles))) THEN
    SELECT public.count_active_admins() INTO _admins_count;
    IF _admins_count <= 1 THEN
      RAISE EXCEPTION 'Operação bloqueada: Não é possível deixar o sistema sem administradores ativos.'
        USING ERRCODE = 'P0001',
              HINT = 'LAST_ADMIN_PROTECTION';
    END IF;
  END IF;

  -- 5. Atualizar Profile
  UPDATE public.profiles
  SET full_name = _full_name,
      active = _active,
      permission_profile_id = _permission_profile_id,
      erp_seller_id = _erp_seller_id,
      updated_at = now()
  WHERE id = _target_user_id;

  -- 6. Atualizar Empresas
  DELETE FROM public.user_company_access WHERE user_id = _target_user_id;
  IF array_length(_company_ids, 1) > 0 THEN
    INSERT INTO public.user_company_access (user_id, company_id)
    SELECT _target_user_id, unnest(_company_ids);
  END IF;

  -- 7. Atualizar Roles
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  IF array_length(_final_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT _target_user_id, unnest(_final_roles);
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user TO service_role;

-- 3. RPC para configurar tabelas públicas de novo usuário convidado
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
  _new_profile_name text;
  _new_profile_is_system boolean;
  _final_roles text[];
BEGIN
  SELECT name, is_system INTO _new_profile_name, _new_profile_is_system
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  _final_roles := _roles;
  IF _new_profile_name = 'Administrador' AND _new_profile_is_system = true THEN
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  INSERT INTO public.profiles (id, full_name, active, permission_profile_id, erp_seller_id)
  VALUES (_user_id, _full_name, true, _permission_profile_id, _erp_seller_id)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      permission_profile_id = EXCLUDED.permission_profile_id,
      erp_seller_id = EXCLUDED.erp_seller_id,
      active = true;

  DELETE FROM public.user_company_access WHERE user_id = _user_id;
  IF array_length(_company_ids, 1) > 0 THEN
    INSERT INTO public.user_company_access (user_id, company_id)
    SELECT _user_id, unnest(_company_ids);
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  IF array_length(_final_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, unnest(_final_roles);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_setup_invited_user FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_setup_invited_user FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_invited_user TO service_role;
