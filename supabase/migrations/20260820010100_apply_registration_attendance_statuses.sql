update public.registration_topics
set status = 'Onsite'
where status = 'Participant';

update public.registration_topics
set status = 'Record'
where status in ('Waiting', 'skip');

create or replace function public.assign_registration_topic_status()
returns trigger
language plpgsql
as $$
declare
  onsite_count integer;
begin
  if new.status = 'Record' then
    return new;
  end if;

  select count(*)
  into onsite_count
  from public.registration_topics
  where workshop_id = new.workshop_id
    and status = 'Onsite';

  if onsite_count >= 40 then
    new.status = 'Waiting';
  else
    new.status = 'Onsite';
  end if;

  return new;
end;
$$;

drop policy if exists registrations_select_public on public.registrations;
create policy registrations_select_public
on public.registrations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registration_topics
    where registration_topics.registration_id = registrations.id
      and registration_topics.status in ('Onsite', 'Waiting', 'Record')
  )
);

drop policy if exists registration_topics_select_public on public.registration_topics;
create policy registration_topics_select_public
on public.registration_topics
for select
to anon, authenticated
using (status in ('Onsite', 'Waiting', 'Record'));

drop policy if exists registration_topics_update_public on public.registration_topics;
create policy registration_topics_update_public
on public.registration_topics
for update
to anon, authenticated
using (true)
with check (status in ('Onsite', 'Waiting', 'Record'));