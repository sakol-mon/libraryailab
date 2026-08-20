insert into public.workshops (code, title, topic_name, event_date, is_active)
values
  ('register-status', 'ครั้งที่ 0', 'Register status', '2026-01-01', true),
  ('onsite-status', 'ครั้งที่ 0.1', 'Onsite status', '2026-01-01', true)
on conflict (code)
do update set
  title = excluded.title,
  topic_name = excluded.topic_name,
  event_date = excluded.event_date,
  is_active = excluded.is_active;
