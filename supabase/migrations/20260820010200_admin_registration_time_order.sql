drop function if exists public.admin_list_registrations_all();

create function public.admin_list_registrations_all()
returns table(id uuid, full_name text, email text, created_at timestamp with time zone)
language sql
security definer
set search_path = public
as $$
  select id, full_name, email, created_at
  from public.registrations
  order by created_at asc;
$$;

grant execute on function public.admin_list_registrations_all() to anon, authenticated;