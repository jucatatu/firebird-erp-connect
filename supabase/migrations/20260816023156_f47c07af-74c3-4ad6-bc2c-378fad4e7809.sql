-- SPRINT 8.9.43 — NÚCLEO DE PERMISSÕES POR ÁRVORE
-- Implementação do novo sistema de perfis, recursos e regras.

-- 1. Tabela de Perfis de Permissão
CREATE TABLE public.permission_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NULL REFERENCES auth.users(id),
    updated_by UUID NULL REFERENCES auth.users(id)
);

-- Unicidade case-insensitive para o nome do perfil
CREATE UNIQUE INDEX idx_permission_profiles_name_lower ON public.permission_profiles (lower(name));

-- Grants para permission_profiles
GRANT SELECT ON public.permission_profiles TO authenticated;
GRANT ALL ON public.permission_profiles TO service_role;

-- 2. Tabela de Recursos (Árvore Hierárquica)
CREATE TABLE public.permission_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NULL,
    parent_id UUID NULL REFERENCES public.permission_resources(id),
    route TEXT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants para permission_resources
GRANT SELECT ON public.permission_resources TO authenticated;
GRANT ALL ON public.permission_resources TO service_role;

-- 3. Tabela de Regras (Junction Profile x Resource)
CREATE TABLE public.permission_profile_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES public.permission_resources(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT permission_profile_rules_unique UNIQUE(profile_id, resource_id)
);

-- Índices para performance
CREATE INDEX idx_permission_profile_rules_profile_id ON public.permission_profile_rules(profile_id);
CREATE INDEX idx_permission_profile_rules_resource_id ON public.permission_profile_rules(resource_id);

-- Grants para permission_profile_rules
GRANT SELECT ON public.permission_profile_rules TO authenticated;
GRANT ALL ON public.permission_profile_rules TO service_role;

-- 4. Vínculo do Perfil ao Usuário (profiles)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'permission_profile_id') THEN
        ALTER TABLE public.profiles ADD COLUMN permission_profile_id UUID REFERENCES public.permission_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Triggers para updated_at (assumindo que public.set_updated_at já existe)
CREATE TRIGGER tr_permission_profiles_set_updated_at
    BEFORE UPDATE ON public.permission_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_permission_resources_set_updated_at
    BEFORE UPDATE ON public.permission_resources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_permission_profile_rules_set_updated_at
    BEFORE UPDATE ON public.permission_profile_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Ativar RLS
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_profile_rules ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- resources: Todos autenticados podem ver ativos. Admin CRUD.
CREATE POLICY "Resources are viewable by authenticated" ON public.permission_resources
    FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "Resources are manageable by admins" ON public.permission_resources
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles: Ver próprio perfil vinculado. Admin CRUD.
CREATE POLICY "Profiles are viewable by assigned users" ON public.permission_profiles
    FOR SELECT TO authenticated USING (
        id IN (SELECT permission_profile_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Profiles are manageable by admins" ON public.permission_profiles
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- rules: Ver próprias regras. Admin CRUD.
CREATE POLICY "Rules are viewable by assigned users" ON public.permission_profile_rules
    FOR SELECT TO authenticated USING (
        profile_id IN (SELECT permission_profile_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Rules are manageable by admins" ON public.permission_profile_rules
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Função has_permission
CREATE OR REPLACE FUNCTION public.has_permission(
    _user_id UUID,
    _resource_key TEXT,
    _action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    _profile_id UUID;
    _resource_id UUID;
    _has_perm BOOLEAN := FALSE;
BEGIN
    -- 1. Resolver perfil do usuário (deve estar ativo)
    SELECT p.permission_profile_id INTO _profile_id
    FROM public.profiles p
    JOIN public.permission_profiles pp ON pp.id = p.permission_profile_id
    WHERE p.id = _user_id AND pp.active = TRUE;

    IF _profile_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Resolver recurso (deve estar ativo)
    SELECT id INTO _resource_id
    FROM public.permission_resources
    WHERE key = _resource_key AND active = TRUE;

    IF _resource_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 3. Validar ação e flag correspondente
    CASE _action
        WHEN 'view' THEN
            SELECT can_view INTO _has_perm FROM public.permission_profile_rules WHERE profile_id = _profile_id AND resource_id = _resource_id;
        WHEN 'create' THEN
            SELECT can_create INTO _has_perm FROM public.permission_profile_rules WHERE profile_id = _profile_id AND resource_id = _resource_id;
        WHEN 'edit' THEN
            SELECT can_edit INTO _has_perm FROM public.permission_profile_rules WHERE profile_id = _profile_id AND resource_id = _resource_id;
        WHEN 'delete' THEN
            SELECT can_delete INTO _has_perm FROM public.permission_profile_rules WHERE profile_id = _profile_id AND resource_id = _resource_id;
        ELSE
            RETURN FALSE;
    END CASE;

    RETURN COALESCE(_has_perm, FALSE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, TEXT) TO authenticated, service_role;

-- 9. Seed Inicial da Árvore
WITH erp_root AS (
    INSERT INTO public.permission_resources (key, name, sort_order) VALUES ('root', 'ERP Operacional', 0) RETURNING id
),
operation AS (
    INSERT INTO public.permission_resources (key, name, parent_id, sort_order) 
    SELECT 'operation', 'Operação', id, 10 FROM erp_root RETURNING id
),
commercial AS (
    INSERT INTO public.permission_resources (key, name, parent_id, sort_order) 
    SELECT 'commercial', 'Comercial', id, 20 FROM erp_root RETURNING id
),
administration AS (
    INSERT INTO public.permission_resources (key, name, parent_id, sort_order) 
    SELECT 'admin', 'Administração', id, 30 FROM erp_root RETURNING id
)
INSERT INTO public.permission_resources (key, name, parent_id, sort_order, route)
SELECT 'operation.map', 'Mapa', id, 1, '/operations' FROM operation
UNION ALL
SELECT 'operation.deliveries', 'Entregas', id, 2, '/entregas' FROM operation
UNION ALL
SELECT 'operation.pickups', 'Recolhas', id, 3, '/recolhas' FROM operation
UNION ALL
SELECT 'commercial.orders', 'Pedidos', id, 1, '/pedidos-venda' FROM commercial
UNION ALL
SELECT 'commercial.order_approvals', 'Aprovações', id, 2, '/pedidos-venda/aprovacoes' FROM commercial
UNION ALL
SELECT 'commercial.clients', 'Clientes ERP', id, 3, NULL FROM commercial
UNION ALL
SELECT 'admin.users', 'Usuários', id, 1, NULL FROM administration
UNION ALL
SELECT 'admin.permission_profiles', 'Perfis de Permissão', id, 2, NULL FROM administration
UNION ALL
SELECT 'admin.erp', 'Integração ERP', id, 3, '/settings/erp' FROM administration
UNION ALL
SELECT 'admin.catalog', 'Catálogo', id, 4, '/settings/catalogo' FROM administration
UNION ALL
SELECT 'admin.settings', 'Configurações', id, 5, '/settings/mapa' FROM administration;

-- 10. Perfil Administrador e Regras
DO $$
DECLARE
    _admin_profile_id UUID;
BEGIN
    INSERT INTO public.permission_profiles (name, description, is_system)
    VALUES ('Administrador', 'Acesso completo ao ERP Operacional', true)
    RETURNING id INTO _admin_profile_id;

    -- Conceder tudo para todos os recursos ao Administrador
    INSERT INTO public.permission_profile_rules (profile_id, resource_id, can_view, can_create, can_edit, can_delete)
    SELECT _admin_profile_id, id, true, true, true, true FROM public.permission_resources;

    -- Vincular usuários 'admin' atuais ao novo perfil
    UPDATE public.profiles
    SET permission_profile_id = _admin_profile_id
    WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
END $$;
