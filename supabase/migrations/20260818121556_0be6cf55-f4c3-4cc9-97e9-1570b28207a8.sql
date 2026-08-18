-- Função para contar administradores ativos
create or replace function public.count_active_admins()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct p.id)
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.permission_profiles pp on pp.id = p.permission_profile_id
  where p.active is true
    and ur.role = 'admin'
    and pp.name = 'Administrador'
$$;

grant execute on function public.count_active_admins() to authenticated;
grant execute on function public.count_active_admins() to service_role;