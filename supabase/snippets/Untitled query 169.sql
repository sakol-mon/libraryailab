drop function if exists public.admin_list_registrations_all();

create function public.admin_list_registrations_all()
returns table(
  id uuid,
  full_name text,
  email text,
  phone character varying(25),
  organization text,
  role public.applicant_role,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language sql
security definer
set search_path = public
as $$
  select id, full_name, email, phone, organization, role, created_at, updated_at
  from public.registrations
  order by created_at asc;
$$;

grant execute on function public.admin_list_registrations_all() to anon, authenticated;
