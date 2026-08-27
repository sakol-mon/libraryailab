-- Admin bulk delete: removes a registrant and all related rows across tables, keyed by registrations.id (uuid).
create or replace function public.admin_delete_registrations(ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.registration_topics where registration_id = any(ids);
  delete from public.registrations where id = any(ids);
end;
$$;

grant execute on function public.admin_delete_registrations(uuid[]) to anon, authenticated;
