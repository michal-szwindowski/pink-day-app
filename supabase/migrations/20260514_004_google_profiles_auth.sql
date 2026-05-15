create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text null,
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  invited_by uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  role text not null check (role in ('admin', 'member')),
  display_name text null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allowed_users_invited_by_fkey'
  ) then
    alter table public.allowed_users
      add constraint allowed_users_invited_by_fkey
      foreign key (invited_by) references public.profiles(id) on delete set null;
  end if;
end $$;

alter table public.task_submissions add column if not exists profile_id uuid;
alter table public.task_submissions add column if not exists reviewed_by_profile_id uuid;
alter table public.reward_redemptions add column if not exists profile_id uuid;
alter table public.point_transactions add column if not exists profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_submissions_profile_id_fkey'
  ) then
    alter table public.task_submissions
      add constraint task_submissions_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'task_submissions_reviewed_by_profile_id_fkey'
  ) then
    alter table public.task_submissions
      add constraint task_submissions_reviewed_by_profile_id_fkey
      foreign key (reviewed_by_profile_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reward_redemptions_profile_id_fkey'
  ) then
    alter table public.reward_redemptions
      add constraint reward_redemptions_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'point_transactions_profile_id_fkey'
  ) then
    alter table public.point_transactions
      add constraint point_transactions_profile_id_fkey
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

drop trigger if exists set_allowed_users_updated_at on public.allowed_users;
create trigger set_allowed_users_updated_at
before update on public.allowed_users
for each row
execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

insert into public.profiles (auth_user_id, email, role, display_name, active)
select
  devices.auth_user_id,
  lower(auth_users.email),
  devices.role,
  coalesce(
    devices.display_name,
    auth_users.raw_user_meta_data ->> 'full_name',
    auth_users.raw_user_meta_data ->> 'name',
    split_part(lower(auth_users.email), '@', 1)
  ),
  true
from public.devices devices
join auth.users auth_users on auth_users.id = devices.auth_user_id
where auth_users.email is not null
on conflict (auth_user_id) do update
set
  email = excluded.email,
  role = excluded.role,
  display_name = coalesce(excluded.display_name, public.profiles.display_name),
  active = true,
  updated_at = timezone('utc', now());

insert into public.allowed_users (email, display_name, role, active)
select email, display_name, role, true
from public.profiles
on conflict (email) do update
set
  display_name = coalesce(excluded.display_name, public.allowed_users.display_name),
  role = excluded.role,
  active = true,
  updated_at = timezone('utc', now());

update public.task_submissions submissions
set profile_id = profiles.id
from public.devices devices
join public.profiles profiles on profiles.auth_user_id = devices.auth_user_id
where submissions.device_id = devices.id
  and submissions.profile_id is null;

update public.task_submissions submissions
set reviewed_by_profile_id = profiles.id
from public.devices devices
join public.profiles profiles on profiles.auth_user_id = devices.auth_user_id
where submissions.reviewed_by = devices.id
  and submissions.reviewed_by_profile_id is null;

update public.reward_redemptions redemptions
set profile_id = profiles.id
from public.devices devices
join public.profiles profiles on profiles.auth_user_id = devices.auth_user_id
where redemptions.device_id = devices.id
  and redemptions.profile_id is null;

update public.point_transactions transactions
set profile_id = profiles.id
from public.devices devices
join public.profiles profiles on profiles.auth_user_id = devices.auth_user_id
where transactions.device_id = devices.id
  and transactions.profile_id is null;

create unique index if not exists task_submissions_profile_date_unique
  on public.task_submissions (task_id, profile_id, submission_date)
  where profile_id is not null and status in ('pending', 'approved');

create unique index if not exists point_transactions_submission_unique
  on public.point_transactions (submission_id, reason)
  where submission_id is not null and reason = 'task_approved';

create unique index if not exists point_transactions_redemption_unique
  on public.point_transactions (reward_redemption_id, reason)
  where reward_redemption_id is not null and reason = 'reward_redeemed';

create index if not exists profiles_auth_user_idx on public.profiles (auth_user_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists allowed_users_role_idx on public.allowed_users (role, active);
create index if not exists task_submissions_profile_idx on public.task_submissions (profile_id, created_at desc);
create index if not exists reward_redemptions_profile_idx on public.reward_redemptions (profile_id, created_at desc);
create index if not exists point_transactions_profile_idx on public.point_transactions (profile_id, created_at desc);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.active = true
  limit 1;
$$;

create or replace function public.owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profiles
    where profiles.id = p_profile_id
      and profiles.auth_user_id = auth.uid()
      and profiles.active = true
  );
$$;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profiles
    where profiles.auth_user_id = auth.uid()
      and profiles.active = true
      and profiles.role = 'admin'
  );
$$;

create or replace function public.current_balance_for_profile(p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_transactions
  where profile_id = p_profile_id
    and pair_id = 'main';
$$;

drop function if exists public.sync_current_profile(text);
drop function if exists public.review_submission(text, uuid, uuid, text);
drop function if exists public.request_reward_redemption(uuid, uuid);
drop function if exists public.seed_defaults(uuid);

create or replace function public.sync_current_profile(p_admin_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user auth.users%rowtype;
  v_email text;
  v_allowed public.allowed_users%rowtype;
  v_role text;
  v_display_name text;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji.';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = auth.uid();

  if not found or v_auth_user.email is null then
    return jsonb_build_object('status', 'no_access');
  end if;

  v_email := lower(v_auth_user.email);

  select *
  into v_allowed
  from public.allowed_users
  where email = v_email
    and active = true
  limit 1;

  if v_email = lower(p_admin_email) then
    v_role := 'admin';
    v_display_name := coalesce(
      v_auth_user.raw_user_meta_data ->> 'full_name',
      v_auth_user.raw_user_meta_data ->> 'name',
      'Michał'
    );
  elsif found then
    v_role := v_allowed.role;
    v_display_name := coalesce(
      v_allowed.display_name,
      v_auth_user.raw_user_meta_data ->> 'full_name',
      v_auth_user.raw_user_meta_data ->> 'name',
      split_part(v_email, '@', 1)
    );
  else
    update public.profiles
    set
      active = false,
      updated_at = timezone('utc', now())
    where auth_user_id = auth.uid();
    return jsonb_build_object('status', 'no_access', 'email', v_email);
  end if;

  insert into public.profiles (auth_user_id, email, role, display_name, active)
  values (auth.uid(), v_email, v_role, v_display_name, true)
  on conflict (auth_user_id) do update
  set
    email = excluded.email,
    role = excluded.role,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    active = true,
    updated_at = timezone('utc', now())
  returning *
  into v_profile;

  if v_email = lower(p_admin_email) then
    insert into public.allowed_users (email, display_name, role, active, invited_by)
    values (v_email, v_profile.display_name, 'admin', true, v_profile.id)
    on conflict (email) do update
    set
      display_name = coalesce(excluded.display_name, public.allowed_users.display_name),
      role = 'admin',
      active = true,
      invited_by = coalesce(public.allowed_users.invited_by, excluded.invited_by),
      updated_at = timezone('utc', now());
  end if;

  return jsonb_build_object(
    'status', 'ready',
    'profile_id', v_profile.id,
    'role', v_profile.role,
    'email', v_profile.email
  );
end;
$$;

create or replace function public.review_submission(
  p_action text,
  p_admin_profile_id uuid,
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
  if not public.owns_profile(p_admin_profile_id) or not public.is_current_admin() then
    raise exception 'Tylko admin może rozpatrywać zgłoszenia.';
  end if;

  select *
  into v_submission
  from public.task_submissions
  where id = p_submission_id
    and pair_id = 'main';

  if not found then
    raise exception 'Nie znaleziono zgłoszenia.';
  end if;

  select *
  into v_task
  from public.tasks
  where id = v_submission.task_id;

  if not found then
    raise exception 'Nie znaleziono zadania dla tego zgłoszenia.';
  end if;

  if p_action = 'approve' then
    if v_submission.status = 'approved' then
      raise exception 'To zgłoszenie jest już zaakceptowane.';
    end if;

    update public.task_submissions
    set
      status = 'approved',
      rejection_reason = null,
      points_awarded = v_task.points,
      reviewed_at = timezone('utc', now()),
      reviewed_by_profile_id = p_admin_profile_id
    where id = p_submission_id;

    insert into public.point_transactions (
      pair_id,
      profile_id,
      amount,
      reason,
      submission_id,
      note
    )
    values (
      'main',
      v_submission.profile_id,
      v_task.points,
      'task_approved',
      v_submission.id,
      v_task.title
    )
    on conflict (submission_id, reason) where reason = 'task_approved' do nothing;

    return 'approved';
  end if;

  if p_action = 'reject' then
    if coalesce(trim(p_rejection_reason), '') = '' then
      raise exception 'Powód odrzucenia jest wymagany.';
    end if;

    delete from public.point_transactions
    where submission_id = v_submission.id
      and reason = 'task_approved';

    update public.task_submissions
    set
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      points_awarded = 0,
      reviewed_at = timezone('utc', now()),
      reviewed_by_profile_id = p_admin_profile_id
    where id = p_submission_id;

    return 'rejected';
  end if;

  if p_action = 'reset' then
    delete from public.point_transactions
    where submission_id = v_submission.id
      and reason = 'task_approved';

    update public.task_submissions
    set
      status = 'pending',
      rejection_reason = null,
      points_awarded = 0,
      reviewed_at = null,
      reviewed_by_profile_id = null
    where id = p_submission_id;

    return 'reset';
  end if;

  raise exception 'Nieznana akcja: %', p_action;
end;
$$;

create or replace function public.request_reward_redemption(
  p_profile_id uuid,
  p_reward_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
  v_redemption_id uuid;
  v_balance integer;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Możesz odbierać nagrody tylko ze swojego konta.';
  end if;

  select *
  into v_reward
  from public.rewards
  where id = p_reward_id
    and pair_id = 'main'
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnej nagrody.';
  end if;

  v_balance := public.current_balance_for_profile(p_profile_id);
  if v_balance < v_reward.cost then
    raise exception 'Za mało punktów.';
  end if;

  insert into public.reward_redemptions (
    pair_id,
    profile_id,
    reward_id,
    reward_title,
    cost,
    status
  )
  values (
    'main',
    p_profile_id,
    v_reward.id,
    v_reward.title,
    v_reward.cost,
    'requested'
  )
  returning id
  into v_redemption_id;

  insert into public.point_transactions (
    pair_id,
    profile_id,
    amount,
    reason,
    reward_redemption_id,
    note
  )
  values (
    'main',
    p_profile_id,
    -v_reward.cost,
    'reward_redeemed',
    v_redemption_id,
    v_reward.title
  );

  return v_redemption_id;
end;
$$;

create or replace function public.seed_defaults(p_admin_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_profile(p_admin_profile_id) or not public.is_current_admin() then
    raise exception 'Tylko admin może dodawać dane startowe.';
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

  return 'ok';
end;
$$;

alter table public.profiles enable row level security;
alter table public.allowed_users enable row level security;
alter table public.task_submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (public.is_current_admin() or auth_user_id = auth.uid());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists "allowed_users_admin_select" on public.allowed_users;
create policy "allowed_users_admin_select"
on public.allowed_users
for select
to authenticated
using (public.is_current_admin());

drop policy if exists "allowed_users_admin_insert" on public.allowed_users;
create policy "allowed_users_admin_insert"
on public.allowed_users
for insert
to authenticated
with check (public.is_current_admin());

drop policy if exists "allowed_users_admin_update" on public.allowed_users;
create policy "allowed_users_admin_update"
on public.allowed_users
for update
to authenticated
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists "tasks_select_pair" on public.tasks;
create policy "tasks_select_pair"
on public.tasks
for select
to authenticated
using (pair_id = 'main');

drop policy if exists "tasks_admin_insert" on public.tasks;
create policy "tasks_admin_insert"
on public.tasks
for insert
to authenticated
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "tasks_admin_update" on public.tasks;
create policy "tasks_admin_update"
on public.tasks
for update
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "rewards_select_pair" on public.rewards;
create policy "rewards_select_pair"
on public.rewards
for select
to authenticated
using (pair_id = 'main');

drop policy if exists "rewards_admin_insert" on public.rewards;
create policy "rewards_admin_insert"
on public.rewards
for insert
to authenticated
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "rewards_admin_update" on public.rewards;
create policy "rewards_admin_update"
on public.rewards
for update
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "task_submissions_select_own_or_admin" on public.task_submissions;
drop policy if exists "task_submissions_select_member" on public.task_submissions;
create policy "task_submissions_select_own_or_admin"
on public.task_submissions
for select
to authenticated
using (
  pair_id = 'main'
  and (
    public.is_current_admin()
    or profile_id = public.current_profile_id()
  )
);

drop policy if exists "task_submissions_insert_own" on public.task_submissions;
drop policy if exists "task_submissions_insert_member" on public.task_submissions;
create policy "task_submissions_insert_own"
on public.task_submissions
for insert
to authenticated
with check (
  pair_id = 'main'
  and profile_id = public.current_profile_id()
  and status = 'pending'
);

drop policy if exists "task_submissions_delete_own" on public.task_submissions;
create policy "task_submissions_delete_own"
on public.task_submissions
for delete
to authenticated
using (
  pair_id = 'main'
  and profile_id = public.current_profile_id()
  and status in ('pending', 'rejected')
);

drop policy if exists "submission_photos_select_related" on public.submission_photos;
create policy "submission_photos_select_related"
on public.submission_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.task_submissions submissions
    where submissions.id = submission_photos.submission_id
      and submissions.pair_id = 'main'
      and (
        public.is_current_admin()
        or submissions.profile_id = public.current_profile_id()
      )
  )
);

drop policy if exists "submission_photos_insert_related" on public.submission_photos;
create policy "submission_photos_insert_related"
on public.submission_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.task_submissions submissions
    where submissions.id = submission_photos.submission_id
      and submissions.pair_id = 'main'
      and submissions.profile_id = public.current_profile_id()
      and submissions.status = 'pending'
  )
);

drop policy if exists "reward_redemptions_select_own_or_admin" on public.reward_redemptions;
drop policy if exists "reward_redemptions_select_member" on public.reward_redemptions;
create policy "reward_redemptions_select_own_or_admin"
on public.reward_redemptions
for select
to authenticated
using (
  pair_id = 'main'
  and (
    public.is_current_admin()
    or profile_id = public.current_profile_id()
  )
);

drop policy if exists "reward_redemptions_admin_update" on public.reward_redemptions;
create policy "reward_redemptions_admin_update"
on public.reward_redemptions
for update
to authenticated
using (pair_id = 'main' and public.is_current_admin())
with check (pair_id = 'main' and public.is_current_admin());

drop policy if exists "point_transactions_select_own_or_admin" on public.point_transactions;
drop policy if exists "point_transactions_select_member" on public.point_transactions;
create policy "point_transactions_select_own_or_admin"
on public.point_transactions
for select
to authenticated
using (
  pair_id = 'main'
  and (
    public.is_current_admin()
    or profile_id = public.current_profile_id()
  )
);

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

drop policy if exists "task_photos_select" on storage.objects;
create policy "task_photos_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and (
    public.is_current_admin()
    or (
      (storage.foldername(name))[1] = 'main'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

drop policy if exists "task_photos_insert" on storage.objects;
create policy "task_photos_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and (storage.foldername(name))[1] = 'main'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "task_photos_delete" on storage.objects;
create policy "task_photos_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-photos'
  and (
    public.is_current_admin()
    or (
      (storage.foldername(name))[1] = 'main'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);
