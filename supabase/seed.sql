insert into public.tasks (pair_id, title, description, points, type, date, requires_photo, active)
select *
from (
  values
    ('main', 'Wypij wodę', null, 5, 'daily', null, false, true),
    ('main', 'Spacer', null, 10, 'daily', null, false, true),
    ('main', 'Trening', null, 20, 'daily', null, true, true)
) as seed_rows(pair_id, title, description, points, type, date, requires_photo, active)
where not exists (
  select 1 from public.tasks where pair_id = 'main'
);

insert into public.rewards (pair_id, title, description, cost, active)
select *
from (
  values
    ('main', 'Wybór filmu', null, 30, true),
    ('main', 'Masaż', null, 50, true),
    ('main', 'Randka-niespodzianka', null, 100, true)
) as seed_rows(pair_id, title, description, cost, active)
where not exists (
  select 1 from public.rewards where pair_id = 'main'
);
