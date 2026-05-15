create extension if not exists pgcrypto;

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  pair_id text not null default 'main',
  role text not null check (role in ('admin', 'member')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  pair_id text not null default 'main',
  title text not null,
  description text,
  points integer not null check (points > 0),
  type text not null check (type in ('daily', 'one_time')),
  date text null,
  requires_photo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_type_date_check check (
    (type = 'daily' and date is null) or
    (type = 'one_time' and date ~ '^\d{4}-\d{2}-\d{2}$')
  )
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  pair_id text not null default 'main',
  task_id uuid not null references public.tasks(id),
  device_id uuid not null references public.devices(id),
  submission_date text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text null,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.devices(id),
  constraint task_submissions_date_check check (submission_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create table if not exists public.submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  pair_id text not null default 'main',
  title text not null,
  description text,
  cost integer not null check (cost > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  pair_id text not null default 'main',
  device_id uuid not null references public.devices(id),
  reward_id uuid not null references public.rewards(id),
  reward_title text not null,
  cost integer not null,
  status text not null default 'requested' check (status in ('requested', 'fulfilled')),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz null
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  pair_id text not null default 'main',
  device_id uuid not null references public.devices(id),
  amount integer not null,
  reason text not null check (reason in ('task_approved', 'reward_redeemed', 'manual_adjustment')),
  submission_id uuid null references public.task_submissions(id),
  reward_redemption_id uuid null references public.reward_redemptions(id),
  note text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists task_submissions_one_active_per_day
  on public.task_submissions (task_id, device_id, submission_date)
  where status in ('pending', 'approved');

create unique index if not exists point_transactions_unique_task_approval
  on public.point_transactions (submission_id)
  where reason = 'task_approved' and submission_id is not null;

create unique index if not exists point_transactions_unique_reward_redemption
  on public.point_transactions (reward_redemption_id)
  where reason = 'reward_redeemed' and reward_redemption_id is not null;

create index if not exists tasks_pair_active_idx on public.tasks (pair_id, active, type, date);
create index if not exists submissions_pair_status_idx on public.task_submissions (pair_id, status, submission_date);
create index if not exists rewards_pair_active_idx on public.rewards (pair_id, active);
create index if not exists transactions_device_idx on public.point_transactions (device_id, created_at desc);
create index if not exists redemptions_device_idx on public.reward_redemptions (device_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists rewards_set_updated_at on public.rewards;
create trigger rewards_set_updated_at
before update on public.rewards
for each row
execute function public.set_updated_at();

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devices
    where auth_user_id = auth.uid()
      and pair_id = 'main'
      and role = 'admin'
  );
$$;

create or replace function public.owns_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devices
    where id = p_device_id
      and auth_user_id = auth.uid()
      and pair_id = 'main'
  );
$$;

create or replace function public.owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_submissions submissions
    join public.devices devices on devices.id = submissions.device_id
    where submissions.id = p_submission_id
      and devices.auth_user_id = auth.uid()
      and submissions.pair_id = 'main'
  );
$$;

create or replace function public.has_current_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.devices
    where auth_user_id = auth.uid()
      and pair_id = 'main'
      and role = p_role
  );
$$;

create or replace function public.can_access_member_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_current_admin()
    or (
      public.has_current_role('member')
      and exists (
        select 1
        from public.devices
        where id = p_device_id
          and pair_id = 'main'
          and role = 'member'
      )
    );
$$;

create or replace function public.can_access_member_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_current_admin()
    or (
      public.has_current_role('member')
      and exists (
        select 1
        from public.task_submissions submissions
        join public.devices devices on devices.id = submissions.device_id
        where submissions.id = p_submission_id
          and submissions.pair_id = 'main'
          and devices.role = 'member'
      )
    );
$$;

create or replace function public.current_balance_for_device(p_device_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_transactions
  where device_id = p_device_id
    and pair_id = 'main';
$$;

create or replace function public.current_balance_for_role(p_role text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(transactions.amount), 0)::integer
  from public.point_transactions transactions
  join public.devices devices on devices.id = transactions.device_id
  where transactions.pair_id = 'main'
    and devices.pair_id = 'main'
    and devices.role = p_role;
$$;

create or replace function public.review_submission(
  p_action text,
  p_admin_device_id uuid,
  p_submission_id uuid,
  p_rejection_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.task_submissions%rowtype;
  v_task public.tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji.';
  end if;

  if p_action not in ('approve', 'reject', 'reset') then
    raise exception 'Nieprawidłowa akcja.';
  end if;

  if not public.owns_device(p_admin_device_id) or not public.is_current_admin() then
    raise exception 'Brak uprawnień administratora.';
  end if;

  select * into v_submission
  from public.task_submissions
  where id = p_submission_id
    and pair_id = 'main'
  for update;

  if v_submission.id is null then
    raise exception 'Nie znaleziono zgłoszenia.';
  end if;

  select * into v_task
  from public.tasks
  where id = v_submission.task_id;

  if p_action = 'approve' then
    if v_submission.status <> 'pending' then
      raise exception 'To zgłoszenie zostało już wcześniej rozpatrzone.';
    end if;

    update public.task_submissions
    set
      status = 'approved',
      rejection_reason = null,
      reviewed_at = now(),
      reviewed_by = p_admin_device_id,
      points_awarded = v_task.points
    where id = p_submission_id;

    insert into public.point_transactions (
      pair_id,
      device_id,
      amount,
      reason,
      submission_id,
      note
    )
    values (
      'main',
      v_submission.device_id,
      v_task.points,
      'task_approved',
      v_submission.id,
      v_task.title
    );

    return 'approved';
  end if;

  if p_action = 'reset' then
    if v_submission.status = 'pending' then
      raise exception 'To zgłoszenie już oczekuje na decyzję.';
    end if;

    if v_submission.status = 'approved' then
      delete from public.point_transactions
      where submission_id = v_submission.id
        and reason = 'task_approved';
    end if;

    update public.task_submissions
    set
      status = 'pending',
      rejection_reason = null,
      reviewed_at = null,
      reviewed_by = null,
      points_awarded = 0
    where id = p_submission_id;

    return 'reset';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'To zgłoszenie zostało już wcześniej rozpatrzone.';
  end if;

  if coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Powód odrzucenia jest wymagany.';
  end if;

  update public.task_submissions
  set
    status = 'rejected',
    rejection_reason = trim(p_rejection_reason),
    reviewed_at = now(),
    reviewed_by = p_admin_device_id,
    points_awarded = 0
  where id = p_submission_id;

  return 'rejected';
end;
$$;

create or replace function public.request_reward_redemption(
  p_device_id uuid,
  p_reward_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_redemption_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji.';
  end if;

  if not public.owns_device(p_device_id) then
    raise exception 'To urządzenie nie należy do bieżącego użytkownika.';
  end if;

  if public.is_current_admin() then
    raise exception 'Admin nie powinien odbierać nagród z tego widoku.';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
    and pair_id = 'main'
    and active = true;

  if v_reward.id is null then
    raise exception 'Nie znaleziono aktywnej nagrody.';
  end if;

  v_balance := public.current_balance_for_role('member');

  if v_balance < v_reward.cost then
    raise exception 'Masz za mało punktów na tę nagrodę.';
  end if;

  insert into public.reward_redemptions (
    pair_id,
    device_id,
    reward_id,
    reward_title,
    cost,
    status
  )
  values (
    'main',
    p_device_id,
    v_reward.id,
    v_reward.title,
    v_reward.cost,
    'requested'
  )
  returning id into v_redemption_id;

  insert into public.point_transactions (
    pair_id,
    device_id,
    amount,
    reason,
    reward_redemption_id,
    note
  )
  values (
    'main',
    p_device_id,
    -v_reward.cost,
    'reward_redeemed',
    v_redemption_id,
    v_reward.title
  );

  return v_redemption_id::text;
end;
$$;

create or replace function public.seed_defaults(p_admin_device_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji.';
  end if;

  if not public.owns_device(p_admin_device_id) or not public.is_current_admin() then
    raise exception 'Brak uprawnień administratora.';
  end if;

  if not exists (select 1 from public.tasks where pair_id = 'main') then
    insert into public.tasks (pair_id, title, description, points, type, date, requires_photo, active)
    values
      ('main', 'Wypij wodę', null, 5, 'daily', null, false, true),
      ('main', 'Spacer', null, 10, 'daily', null, false, true),
      ('main', 'Trening', null, 20, 'daily', null, true, true);
  end if;

  if not exists (select 1 from public.rewards where pair_id = 'main') then
    insert into public.rewards (pair_id, title, description, cost, active)
    values
      ('main', 'Wybór filmu', null, 30, true),
      ('main', 'Masaż', null, 50, true),
      ('main', 'Randka-niespodzianka', null, 100, true);
  end if;

  return 'seeded';
end;
$$;

alter table public.devices enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.point_transactions enable row level security;

drop policy if exists "devices_select_own_or_admin" on public.devices;
create policy "devices_select_own_or_admin"
on public.devices
for select
to authenticated
using (pair_id = 'main' and (auth_user_id = auth.uid() or public.is_current_admin()));

drop policy if exists "devices_insert_self" on public.devices;
create policy "devices_insert_self"
on public.devices
for insert
to authenticated
with check (
  pair_id = 'main'
  and auth_user_id = auth.uid()
  and role in ('admin', 'member')
);

drop policy if exists "devices_update_self" on public.devices;
create policy "devices_update_self"
on public.devices
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid() and pair_id = 'main');

drop policy if exists "tasks_select_main" on public.tasks;
create policy "tasks_select_main"
on public.tasks
for select
to authenticated
using (pair_id = 'main');

drop policy if exists "tasks_admin_manage" on public.tasks;
create policy "tasks_admin_manage"
on public.tasks
for all
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "submissions_select_own_or_admin" on public.task_submissions;
create policy "submissions_select_own_or_admin"
on public.task_submissions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));

drop policy if exists "submissions_insert_member_own" on public.task_submissions;
create policy "submissions_insert_member_own"
on public.task_submissions
for insert
to authenticated
with check (
  pair_id = 'main'
  and public.owns_device(device_id)
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and points_awarded = 0
);

drop policy if exists "submissions_admin_update" on public.task_submissions;
create policy "submissions_admin_update"
on public.task_submissions
for update
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "submissions_delete_owner_pending" on public.task_submissions;
create policy "submissions_delete_owner_pending"
on public.task_submissions
for delete
to authenticated
using (
  pair_id = 'main'
  and public.owns_device(device_id)
  and status = 'pending'
  and points_awarded = 0
);

drop policy if exists "submission_photos_select" on public.submission_photos;
create policy "submission_photos_select"
on public.submission_photos
for select
to authenticated
using (public.can_access_member_submission(submission_id));

drop policy if exists "submission_photos_insert" on public.submission_photos;
create policy "submission_photos_insert"
on public.submission_photos
for insert
to authenticated
with check (public.owns_submission(submission_id));

drop policy if exists "submission_photos_delete" on public.submission_photos;
create policy "submission_photos_delete"
on public.submission_photos
for delete
to authenticated
using (public.is_current_admin() or public.owns_submission(submission_id));

drop policy if exists "rewards_select_main" on public.rewards;
create policy "rewards_select_main"
on public.rewards
for select
to authenticated
using (pair_id = 'main');

drop policy if exists "rewards_admin_manage" on public.rewards;
create policy "rewards_admin_manage"
on public.rewards
for all
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "redemptions_select_own_or_admin" on public.reward_redemptions;
create policy "redemptions_select_own_or_admin"
on public.reward_redemptions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));

drop policy if exists "redemptions_admin_update" on public.reward_redemptions;
create policy "redemptions_admin_update"
on public.reward_redemptions
for update
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "transactions_select_own_or_admin" on public.point_transactions;
create policy "transactions_select_own_or_admin"
on public.point_transactions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

drop policy if exists "task_photos_select_admin_or_owner" on storage.objects;
create policy "task_photos_select_admin_or_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and (
    public.is_current_admin()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

drop policy if exists "task_photos_insert_owner" on storage.objects;
create policy "task_photos_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and (storage.foldername(name))[1] = 'main'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "task_photos_delete_admin_or_owner" on storage.objects;
create policy "task_photos_delete_admin_or_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-photos'
  and (
    public.is_current_admin()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);
