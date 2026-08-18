CREATE OR REPLACE FUNCTION public.admin_setup_created_user(
  _user_id uuid,
  _full_name text,
  _permission_profile_id uuid,
  _erp_seller_id integer DEFAULT NULL,
  _company_ids integer[] DEFAULT '{}',
  _roles text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_exists boolean;
  _company_id integer;
BEGIN
    -- 1. Validação de integridade do perfil
    IF NOT EXISTS (
        select 1 from public.permission_profiles 
        where id = _permission_profile_id and active = true
    ) THEN
        RAISE EXCEPTION 'Perfil de permissão inexistente ou inativo' USING HINT = 'INVALID_PERMISSION_PROFILE';
    END IF;

    -- 2. Validação de Empresas (Somente 1 e 3 permitidas)
    FOREACH _company_id IN ARRAY _company_ids LOOP
        IF _company_id NOT IN (1, 3) THEN
            RAISE EXCEPTION 'Empresa % inválida', _company_id USING HINT = 'INVALID_COMPANY_ACCESS';
        END IF;
    END LOOP;

    -- 3. Upsert no Profile (Idempotente)
    -- Mantemos must_change_password = true
    INSERT INTO public.profiles (
        id, 
        full_name, 
        permission_profile_id, 
        erp_seller_id, 
        active,
        must_change_password
    )
    VALUES (
        _user_id, 
        _full_name, 
        _permission_profile_id, 
        _erp_seller_id, 
        true,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        permission_profile_id = EXCLUDED.permission_profile_id,
        erp_seller_id = EXCLUDED.erp_seller_id,
        active = true,
        must_change_password = true;

    -- 4. Sincronização de Empresas (Limpa e reinsere)
    DELETE FROM public.user_company_access WHERE user_id = _user_id;
    INSERT INTO public.user_company_access (user_id, company_id)
    SELECT _user_id, unnest(_company_ids);

    -- 5. Sincronização de Roles Legadas (Limpa e reinsere)
    DELETE FROM public.user_roles WHERE user_id = _user_id;
    INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, lower(r)::public.app_role 
    FROM unnest(_roles) r;

END;
$$;

-- Grant necessário
GRANT EXECUTE ON FUNCTION public.admin_setup_created_user TO service_role;
REVOKE ALL ON FUNCTION public.admin_setup_created_user FROM PUBLIC;