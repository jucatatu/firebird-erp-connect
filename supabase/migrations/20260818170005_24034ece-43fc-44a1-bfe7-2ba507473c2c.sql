-- Remover a função antiga para permitir alteração na assinatura (remover defaults)
DROP FUNCTION IF EXISTS public.admin_setup_created_user(uuid,text,uuid,integer,integer[],text[]);

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
  _company_id integer;
BEGIN
  -- SEM pg_advisory_xact_lock aqui (corrigido na Sprint 1.4)

  -- 2. Validar Empresas
  IF _company_ids IS NULL 
     OR cardinality(_company_ids) = 0 
     OR EXISTS (
        SELECT 1 
        FROM unnest(_company_ids) cid 
        WHERE cid NOT IN (1, 3)
     )
  THEN
    RAISE EXCEPTION 'Acesso inválido: Apenas empresas 1 (GRAAL) e 3 (GROTT) são permitidas.'
    USING HINT = 'INVALID_COMPANY_ACCESS';
  END IF;

  -- 3. Obter metadados do perfil e validar autoridade
  SELECT 
    (is_system AND name = 'Administrador'),
    active
  INTO 
    _is_admin_profile,
    _profile_active
  FROM public.permission_profiles
  WHERE id = _permission_profile_id;

  IF NOT FOUND OR _profile_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Perfil de permissão inexistente ou inativo.'
    USING HINT = 'INVALID_PERMISSION_PROFILE';
  END IF;

  -- 4. Normalização ADMIN no Banco (Defesa Final)
  _final_roles := COALESCE(_roles, '{}'::text[]);
  
  IF _is_admin_profile THEN
    -- Garantir role 'admin'
    IF NOT ('admin' = ANY(_final_roles)) THEN
      _final_roles := array_append(_final_roles, 'admin');
    END IF;
  ELSE
    -- Remover role 'admin' se presente em perfil não-admin
    _final_roles := array_remove(_final_roles, 'admin');
  END IF;

  -- 5. Idempotência no Profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    permission_profile_id,
    erp_seller_id,
    active,
    must_change_password,
    updated_at
  )
  VALUES (
    _user_id,
    _full_name,
    _permission_profile_id,
    _erp_seller_id,
    true,
    true,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    permission_profile_id = EXCLUDED.permission_profile_id,
    erp_seller_id = EXCLUDED.erp_seller_id,
    active = true,
    must_change_password = true,
    updated_at = now();

  -- 6. Atualizar Roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  FOREACH _role IN ARRAY _final_roles
  LOOP
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_user_id, _role::public.app_role);
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar roles inválidas ou duplicadas
    END;
  END LOOP;

  -- 7. Atualizar Empresas
  DELETE FROM public.user_company_access WHERE user_id = _user_id;
  
  FOREACH _company_id IN ARRAY _company_ids
  LOOP
    INSERT INTO public.user_company_access (user_id, company_id)
    VALUES (_user_id, _company_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_setup_created_user(uuid,text,uuid,integer,integer[],text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_setup_created_user(uuid,text,uuid,integer,integer[],text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_created_user(uuid,text,uuid,integer,integer[],text[]) TO service_role;
