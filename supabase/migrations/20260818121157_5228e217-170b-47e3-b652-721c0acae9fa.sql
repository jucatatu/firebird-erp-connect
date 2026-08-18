-- Migration Corretiva para has_permission e has_role
-- Sprint 8.9.43.1 - Correção de Regras e Ativação

-- 1. Atualizar has_role
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
      and p.active is true
  )
$$;

-- 2. Atualizar has_permission
create or replace function public.has_permission(_user_id uuid, _resource_key text, _action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _is_user_active boolean;
  _profile_id uuid;
  _is_profile_active boolean;
  _is_resource_active boolean;
begin
  -- 1. Valida Usuário e Perfil
  select p.active, p.permission_profile_id, pp.active
  into _is_user_active, _profile_id, _is_profile_active
  from public.profiles p
  left join public.permission_profiles pp on pp.id = p.permission_profile_id
  where p.id = _user_id;

  if _is_user_active is not true or _profile_id is null or _is_profile_active is not true then
    return false;
  end if;

  -- 2. Valida Recurso
  select active into _is_resource_active
  from public.permission_resources
  where key = _resource_key;

  if _is_resource_active is not true then
    return false;
  end if;

  -- 3. Verifica Regra
  return exists (
    select 1
    from public.permission_profile_rules ppr
    join public.permission_resources pr on pr.id = ppr.resource_id
    where ppr.profile_id = _profile_id
      and pr.key = _resource_key
      and (
        (_action = 'view' and ppr.can_view is true) or
        (_action = 'create' and ppr.can_create is true) or
        (_action = 'edit' and ppr.can_edit is true) or
        (_action = 'delete' and ppr.can_delete is true)
      )
  );
end;
$$;

grant execute on function public.has_permission(uuid, text, text) to authenticated;
grant execute on function public.has_role(uuid, app_role) to authenticated;
grant execute on function public.has_permission(uuid, text, text) to service_role;
grant execute on function public.has_role(uuid, app_role) to service_role;