
-- NOVA MIGRATION: Sprint 8.9.43.1.1 — Hardening Administrativo (v2 - specific types)

-- 1. DROP usando a assinatura EXATA encontrada
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, boolean, uuid, integer, integer[], text[]);
DROP FUNCTION IF EXISTS public.admin_setup_invited_user(uuid, text, uuid, integer, integer[], text[]);

-- 2. Recriação com LOCK transacional e LAST_ADMIN_PROTECTION robusta
CREATE OR REPLACE FUNCTION public.admin_update_user(
    _target_user_id uuid,
    _full_name text,
    _active boolean,
    _permission_profile_id uuid,
    _erp_seller_id integer,
    _company_ids integer[],
    _roles text[] -- Usando text[] para compatibilidade com o que foi detectado
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _active_admins_count integer;
    _is_target_active_admin boolean;
    _profile_is_admin boolean;
    _role_is_admin boolean;
    _cid integer;
    _final_roles text[];
BEGIN
    -- LOCK TRANSACIONAL: Serializa operações administrativas críticas
    -- Chave 7142026 (ADMIN)
    PERFORM pg_advisory_xact_lock(7142026);

    -- 1. Validar Allowlist de Empresas (somente 1 e 3)
    IF _company_ids IS NOT NULL AND array_length(_company_ids, 1) > 0 THEN
        FOREACH _cid IN ARRAY _company_ids LOOP
            IF _cid NOT IN (1, 3) THEN
                RAISE EXCEPTION 'INVALID_COMPANY_ACCESS' USING HINT = 'INVALID_COMPANY_ACCESS';
            END IF;
        END LOOP;
    ELSE
        -- Sistema exige pelo menos uma empresa
        RAISE EXCEPTION 'INVALID_COMPANY_ACCESS' USING HINT = 'INVALID_COMPANY_ACCESS';
    END IF;

    -- 2. Verificar se o perfil alvo é de sistema (Administrador)
    SELECT (is_system AND name = 'Administrador') INTO _profile_is_admin
    FROM permission_profiles
    WHERE id = _permission_profile_id;

    -- 3. Sincronização: Se o perfil é Administrador, a role admin deve estar presente
    _role_is_admin := 'admin' = ANY(_roles);
    _final_roles := _roles;
    
    IF _profile_is_admin AND NOT _role_is_admin THEN
        _final_roles := array_append(_roles, 'admin');
    END IF;

    -- 4. LAST_ADMIN_PROTECTION: Recalcular estado APÓS o lock
    -- Contagem de administradores ativos atuais
    SELECT COUNT(*)::integer INTO _active_admins_count
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE p.active = true 
      AND ur.role = 'admin'
      AND pp.is_system = true
      AND pp.name = 'Administrador';

    -- Verificar se o usuário alvo é atualmente um admin ativo
    SELECT EXISTS (
        SELECT 1 
        FROM profiles p
        JOIN user_roles ur ON ur.user_id = p.id
        JOIN permission_profiles pp ON pp.id = p.permission_profile_id
        WHERE p.id = _target_user_id
          AND p.active = true 
          AND ur.role = 'admin'
          AND pp.is_system = true
          AND pp.name = 'Administrador'
    ) INTO _is_target_active_admin;

    -- Se a operação for desativar ou remover privilégios de um admin ativo,
    -- e ele for o último, bloquear.
    IF _is_target_active_admin AND 
       (_active = false OR NOT _profile_is_admin OR 'admin' != ALL(_final_roles)) AND
       _active_admins_count <= 1 THEN
        RAISE EXCEPTION 'LAST_ADMIN_PROTECTION' USING HINT = 'LAST_ADMIN_PROTECTION';
    END IF;

    -- 5. Persistência Atômica
    -- Atualizar Profile
    UPDATE profiles
    SET full_name = _full_name,
        active = _active,
        permission_profile_id = _permission_profile_id,
        erp_seller_id = _erp_seller_id,
        updated_at = now()
    WHERE id = _target_user_id;

    -- Atualizar Roles (Convertendo text[] para app_role[])
    DELETE FROM user_roles WHERE user_id = _target_user_id;
    INSERT INTO user_roles (user_id, role)
    SELECT _target_user_id, r::public.app_role
    FROM unnest(_final_roles) AS r;

    -- Atualizar Empresas
    DELETE FROM user_company_access WHERE user_id = _target_user_id;
    INSERT INTO user_company_access (user_id, company_id)
    SELECT _target_user_id, unnest(_company_ids);

END;
$$;

-- 3. Refatorar admin_setup_invited_user com allowlist de empresas
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
    _cid integer;
BEGIN
    PERFORM pg_advisory_xact_lock(7142026);

    -- Validar Allowlist de Empresas
    IF _company_ids IS NOT NULL AND array_length(_company_ids, 1) > 0 THEN
        FOREACH _cid IN ARRAY _company_ids LOOP
            IF _cid NOT IN (1, 3) THEN
                RAISE EXCEPTION 'INVALID_COMPANY_ACCESS' USING HINT = 'INVALID_COMPANY_ACCESS';
            END IF;
        END LOOP;
    ELSE
        RAISE EXCEPTION 'INVALID_COMPANY_ACCESS' USING HINT = 'INVALID_COMPANY_ACCESS';
    END IF;

    -- Criar Profile
    INSERT INTO public.profiles (id, full_name, active, permission_profile_id, erp_seller_id)
    VALUES (_user_id, _full_name, true, _permission_profile_id, _erp_seller_id);

    -- Inserir Roles
    INSERT INTO public.user_roles (user_id, role)
    SELECT _user_id, r::public.app_role
    FROM unnest(_roles) AS r;

    -- Inserir Empresas
    INSERT INTO public.user_company_access (user_id, company_id)
    SELECT _user_id, unnest(_company_ids);
END;
$$;

-- 4. Garantir Grants
GRANT EXECUTE ON FUNCTION public.admin_update_user TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_setup_invited_user TO service_role;
REVOKE ALL ON FUNCTION public.admin_update_user FROM public, authenticated;
REVOKE ALL ON FUNCTION public.admin_setup_invited_user FROM public, authenticated;
