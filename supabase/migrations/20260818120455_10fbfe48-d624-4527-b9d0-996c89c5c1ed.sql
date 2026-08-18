-- Migration para validar profiles.active em has_permission e has_role
-- Data: 2026-08-18 (Sprint 8.9.43.1)

-- 1. Atualizar has_role para checar profiles.active
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id
      and ur.role = _role
      and p.active = true
  )
$$;

-- 2. Atualizar has_permission para checar profiles.active
create or replace function public.has_permission(_user_id uuid, _resource_key text, _action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _profile_id uuid;
  _is_active boolean;
begin
  -- Busca o perfil e o status ativo do usuário
  select permission_profile_id, active into _profile_id, _is_active
  from public.profiles
  where id = _user_id;

  -- Se não existir perfil, não for ativo ou não tiver perfil de permissão, nega
  if _profile_id is null or _is_active = false then
    return false;
  end if;

  -- Verifica se existe uma regra explícita permitindo a ação para o recurso
  return exists (
    select 1
    from public.permission_profile_rules ppr
    join public.permission_resources pr on pr.id = ppr.resource_id
    where ppr.profile_id = _profile_id
      and pr.key = _resource_key
      and (
        (_action = 'view' and ppr.can_view = true) or
        (_action = 'create' and ppr.can_create = true) or
        (_action = 'edit' and ppr.can_edit = true) or
        (_action = 'delete' and ppr.can_delete = true)
      )
  );
end;
$$;
