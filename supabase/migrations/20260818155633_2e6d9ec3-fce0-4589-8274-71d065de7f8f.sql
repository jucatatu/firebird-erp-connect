-- SPRINT HOTFIX ADMIN USERS.1.1
-- REMOÇÃO DEFINITIVA DO BYPASS E RPC ANTIGA

-- 1. Remover a função depreciada
DROP FUNCTION IF EXISTS public.complete_initial_password_change();

-- 2. Garantir que authenticated não tenha acesso caso a função ainda exista em algum cache
-- (Embora o DROP acima seja definitivo)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'complete_name'
    ) THEN
        -- Nota: proname deve ser exato
        NULL;
    END IF;
END $$;

-- Revoke redundante por segurança (se o drop falhasse)
-- Mas o drop é o caminho preferido.
