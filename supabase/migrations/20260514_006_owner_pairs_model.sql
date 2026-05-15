alter table public.allowed_users drop constraint if exists allowed_users_role_check;
alter table public.profiles drop constraint if exists profiles_role_check;

update public.allowed_users set role = 'owner' where role = 'admin';
update public.profiles set role = 'owner' where role = 'admin';

alter table public.allowed_users
  add constraint allowed_users_role_check check (role in ('owner', 'member'));

alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'member'));

alter table public.task_submissions alter column device_id drop not null;
alter table public.reward_redemptions alter column device_id drop not null;
alter table public.point_transactions alter column device_id drop not null;

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pair_members (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (pair_id, profile_id)
);

create index if not exists pairs_invite_code_idx on public.pairs (invite_code);
create index if not exists pair_members_profile_idx on public.pair_members (profile_id);
create index if not exists pair_members_pair_idx on public.pair_members (pair_id);
create unique index if not exists point_transactions_submission_task_approved_unique
  on public.point_transactions (submission_id, reason)
  where reason = 'task_approved';

alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;

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

create or replace function public.is_current_owner()
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
      and profiles.role = 'owner'
  );
$$;

create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_current_owner();
$$;

create or replace function public.active_owner_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.allowed_users
  where active = true
    and role = 'owner';
$$;

create or replace function public.prevent_last_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active = true
    and old.role = 'owner'
    and (new.active = false or new.role <> 'owner')
    and public.active_owner_count() <= 1 then
    raise exception 'Aplikacja musi mieć przynajmniej jednego aktywnego ownera.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_owner_loss_trigger on public.allowed_users;
create trigger prevent_last_owner_loss_trigger
before update on public.allowed_users
for each row
execute function public.prevent_last_owner_loss();

create or replace function public.is_pair_member(p_pair_id uuid, p_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pair_members members
    join public.pairs pairs on pairs.id = members.pair_id
    where members.pair_id = p_pair_id
      and members.profile_id = p_profile_id
      and pairs.active = true
  );
$$;

create or replace function public.is_uuid_text(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

drop function if exists public.sync_current_profile(text);
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

  select * into v_auth_user from auth.users where id = auth.uid();

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
    v_role := 'owner';
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
    set active = false, updated_at = timezone('utc', now())
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
  returning * into v_profile;

  if v_email = lower(p_admin_email) then
    insert into public.allowed_users (email, display_name, role, active, invited_by)
    values (v_email, v_profile.display_name, 'owner', true, v_profile.id)
    on conflict (email) do update
    set
      display_name = coalesce(excluded.display_name, public.allowed_users.display_name),
      role = 'owner',
      active = true,
      invited_by = coalesce(public.allowed_users.invited_by, excluded.invited_by),
      updated_at = timezone('utc', now());
  end if;

  return jsonb_build_object('status', 'ready', 'profile_id', v_profile.id, 'role', v_profile.role);
end;
$$;

create or replace function public.generate_pair_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.pairs where invite_code = v_code);
  end loop;

  return v_code;
end;
$$;

drop function if exists public.create_pair(text, uuid);
create or replace function public.create_pair(p_name text, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair_id uuid;
  v_code text;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Możesz tworzyć parę tylko dla swojego profilu.';
  end if;

  v_code := public.generate_pair_code();

  insert into public.pairs (name, invite_code, created_by_profile_id)
  values (coalesce(nullif(trim(p_name), ''), 'Nasza para'), v_code, p_profile_id)
  returning id into v_pair_id;

  insert into public.pair_members (pair_id, profile_id)
  values (v_pair_id, p_profile_id)
  on conflict do nothing;

  insert into public.tasks (pair_id, title, description, points, type, date, requires_photo, active)
  values
    (v_pair_id::text, 'Wypij wodę', null, 5, 'daily', null, false, true),
    (v_pair_id::text, 'Spacer', null, 10, 'daily', null, false, true),
    (v_pair_id::text, 'Trening', null, 20, 'daily', null, true, true);

  insert into public.rewards (pair_id, title, description, cost, active)
  values
    (v_pair_id::text, 'Wybór filmu', null, 30, true),
    (v_pair_id::text, 'Masaż', null, 50, true),
    (v_pair_id::text, 'Randka-niespodzianka', null, 100, true);

  return v_code;
end;
$$;

drop function if exists public.join_pair_by_code(text, uuid);
create or replace function public.join_pair_by_code(p_invite_code text, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair_id uuid;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Możesz dołączyć tylko swoim profilem.';
  end if;

  select id
  into v_pair_id
  from public.pairs
  where invite_code = upper(trim(p_invite_code))
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnej pary z tym kodem.';
  end if;

  insert into public.pair_members (pair_id, profile_id)
  values (v_pair_id, p_profile_id)
  on conflict do nothing;

  return v_pair_id;
end;
$$;

drop function if exists public.request_reward_redemption(uuid, uuid);
drop function if exists public.request_reward_redemption(uuid, uuid, uuid);
drop function if exists public.current_balance_for_profile(uuid);
create or replace function public.current_balance_for_profile(p_profile_id uuid, p_pair_id text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_transactions
  where profile_id = p_profile_id
    and (p_pair_id is null or pair_id = p_pair_id);
$$;

drop function if exists public.review_submission(text, uuid, uuid, text);
create or replace function public.review_submission(
  p_action text,
  p_reviewer_profile_id uuid,
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
  select * into v_submission from public.task_submissions where id = p_submission_id;

  if not found then
    raise exception 'Nie znaleziono zgłoszenia.';
  end if;

  if not public.owns_profile(p_reviewer_profile_id)
    or not public.is_pair_member(v_submission.pair_id::uuid, p_reviewer_profile_id) then
    raise exception 'Tylko osoba z tej pary może rozpatrywać zgłoszenia.';
  end if;

  if v_submission.profile_id = p_reviewer_profile_id then
    raise exception 'Nie mozesz rozpatrywac wlasnego zgloszenia.';
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if p_action = 'approve' then
    if v_submission.status = 'approved' then
      raise exception 'To zgłoszenie jest już zaakceptowane.';
    end if;

    update public.task_submissions
    set status = 'approved',
      rejection_reason = null,
      points_awarded = v_task.points,
      reviewed_at = timezone('utc', now()),
      reviewed_by_profile_id = p_reviewer_profile_id
    where id = p_submission_id;

    insert into public.point_transactions (pair_id, profile_id, amount, reason, submission_id, note)
    values (v_submission.pair_id, v_submission.profile_id, v_task.points, 'task_approved', v_submission.id, v_task.title)
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
    set status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      points_awarded = 0,
      reviewed_at = timezone('utc', now()),
      reviewed_by_profile_id = p_reviewer_profile_id
    where id = p_submission_id;

    return 'rejected';
  end if;

  if p_action = 'reset' then
    delete from public.point_transactions
    where submission_id = v_submission.id
      and reason = 'task_approved';

    update public.task_submissions
    set status = 'pending',
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
  p_pair_id uuid,
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
  if not public.owns_profile(p_profile_id) or not public.is_pair_member(p_pair_id, p_profile_id) then
    raise exception 'Możesz odbierać nagrody tylko w swojej parze.';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
    and pair_id = p_pair_id::text
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnej nagrody.';
  end if;

  v_balance := public.current_balance_for_profile(p_profile_id, p_pair_id::text);
  if v_balance < v_reward.cost then
    raise exception 'Za mało punktów.';
  end if;

  insert into public.reward_redemptions (pair_id, profile_id, reward_id, reward_title, cost, status)
  values (p_pair_id::text, p_profile_id, v_reward.id, v_reward.title, v_reward.cost, 'requested')
  returning id into v_redemption_id;

  insert into public.point_transactions (pair_id, profile_id, amount, reason, reward_redemption_id, note)
  values (p_pair_id::text, p_profile_id, -v_reward.cost, 'reward_redeemed', v_redemption_id, v_reward.title);

  return v_redemption_id;
end;
$$;

drop function if exists public.seed_defaults(uuid);
drop function if exists public.seed_defaults(uuid, uuid);
create or replace function public.seed_defaults(p_pair_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_profile(p_profile_id) or not public.is_pair_member(p_pair_id, p_profile_id) then
    raise exception 'Tylko osoba z tej pary może dodać dane startowe.';
  end if;

  if not exists (select 1 from public.tasks where pair_id = p_pair_id::text) then
    insert into public.tasks (pair_id, title, description, points, type, date, requires_photo, active)
    values
      (p_pair_id::text, 'Wypij wodę', null, 5, 'daily', null, false, true),
      (p_pair_id::text, 'Spacer', null, 10, 'daily', null, false, true),
      (p_pair_id::text, 'Trening', null, 20, 'daily', null, true, true);
  end if;

  if not exists (select 1 from public.rewards where pair_id = p_pair_id::text) then
    insert into public.rewards (pair_id, title, description, cost, active)
    values
      (p_pair_id::text, 'Wybór filmu', null, 30, true),
      (p_pair_id::text, 'Masaż', null, 50, true),
      (p_pair_id::text, 'Randka-niespodzianka', null, 100, true);
  end if;

  return 'ok';
end;
$$;

drop function if exists public.update_profile_display_name(uuid, text);
create or replace function public.update_profile_display_name(
  p_profile_id uuid,
  p_display_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Możesz zmieniać tylko swój profil.';
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Nazwa nie może być pusta.';
  end if;

  update public.profiles
  set
    display_name = trim(p_display_name),
    updated_at = timezone('utc', now())
  where id = p_profile_id
  returning * into v_profile;

  update public.allowed_users
  set
    display_name = trim(p_display_name),
    updated_at = timezone('utc', now())
  where email = v_profile.email;

  return v_profile;
end;
$$;

drop function if exists public.leave_pair(uuid, uuid);
create or replace function public.leave_pair(p_pair_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Możesz opuścić parę tylko swoim profilem.';
  end if;

  delete from public.pair_members
  where pair_id = p_pair_id
    and profile_id = p_profile_id;

  if not exists (select 1 from public.pair_members where pair_id = p_pair_id) then
    update public.pairs
    set active = false
    where id = p_pair_id;
  end if;

  return 'left';
end;
$$;

drop policy if exists "pairs_select_member" on public.pairs;
create policy "pairs_select_member"
on public.pairs
for select
to authenticated
using (public.is_pair_member(id));

drop policy if exists "pair_members_select_member" on public.pair_members;
create policy "pair_members_select_member"
on public.pair_members
for select
to authenticated
using (public.is_pair_member(pair_id));

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_select_own_or_owner" on public.profiles;
create policy "profiles_select_own_or_owner"
on public.profiles
for select
to authenticated
using (public.is_current_owner() or auth_user_id = auth.uid());

drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
on public.profiles
for update
to authenticated
using (public.is_current_owner())
with check (public.is_current_owner());

drop policy if exists "allowed_users_admin_select" on public.allowed_users;
drop policy if exists "allowed_users_owner_select" on public.allowed_users;
create policy "allowed_users_owner_select"
on public.allowed_users
for select
to authenticated
using (public.is_current_owner());

drop policy if exists "allowed_users_admin_insert" on public.allowed_users;
drop policy if exists "allowed_users_owner_insert" on public.allowed_users;
create policy "allowed_users_owner_insert"
on public.allowed_users
for insert
to authenticated
with check (public.is_current_owner());

drop policy if exists "allowed_users_admin_update" on public.allowed_users;
drop policy if exists "allowed_users_owner_update" on public.allowed_users;
create policy "allowed_users_owner_update"
on public.allowed_users
for update
to authenticated
using (public.is_current_owner())
with check (
  public.is_current_owner()
);

drop policy if exists "tasks_select_pair" on public.tasks;
create policy "tasks_select_pair"
on public.tasks
for select
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "tasks_admin_insert" on public.tasks;
drop policy if exists "tasks_pair_insert" on public.tasks;
create policy "tasks_pair_insert"
on public.tasks
for insert
to authenticated
with check (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "tasks_admin_update" on public.tasks;
drop policy if exists "tasks_pair_update" on public.tasks;
create policy "tasks_pair_update"
on public.tasks
for update
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid))
with check (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "rewards_select_pair" on public.rewards;
create policy "rewards_select_pair"
on public.rewards
for select
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "rewards_admin_insert" on public.rewards;
drop policy if exists "rewards_pair_insert" on public.rewards;
create policy "rewards_pair_insert"
on public.rewards
for insert
to authenticated
with check (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "rewards_admin_update" on public.rewards;
drop policy if exists "rewards_pair_update" on public.rewards;
create policy "rewards_pair_update"
on public.rewards
for update
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid))
with check (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "task_submissions_select_own_or_admin" on public.task_submissions;
drop policy if exists "task_submissions_select_pair" on public.task_submissions;
create policy "task_submissions_select_pair"
on public.task_submissions
for select
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "task_submissions_insert_own" on public.task_submissions;
drop policy if exists "task_submissions_insert_pair_own" on public.task_submissions;
create policy "task_submissions_insert_pair_own"
on public.task_submissions
for insert
to authenticated
with check (
  profile_id = public.current_profile_id()
  and public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and status = 'pending'
);

drop policy if exists "reward_redemptions_select_own_or_admin" on public.reward_redemptions;
drop policy if exists "reward_redemptions_select_pair" on public.reward_redemptions;
create policy "reward_redemptions_select_pair"
on public.reward_redemptions
for select
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "reward_redemptions_admin_update" on public.reward_redemptions;
drop policy if exists "reward_redemptions_pair_update" on public.reward_redemptions;
create policy "reward_redemptions_pair_update"
on public.reward_redemptions
for update
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid))
with check (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

drop policy if exists "point_transactions_select_own_or_admin" on public.point_transactions;
drop policy if exists "point_transactions_select_pair" on public.point_transactions;
create policy "point_transactions_select_pair"
on public.point_transactions
for select
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "task_photos_select_admin_or_owner" on storage.objects;
drop policy if exists "task_photos_insert_owner" on storage.objects;
drop policy if exists "task_photos_delete_admin_or_owner" on storage.objects;
drop policy if exists "task_photos_select" on storage.objects;
drop policy if exists "task_photos_insert" on storage.objects;
drop policy if exists "task_photos_delete" on storage.objects;
drop policy if exists "task_photos_select_pair" on storage.objects;
drop policy if exists "task_photos_insert_pair_member" on storage.objects;
drop policy if exists "task_photos_delete_pair_member" on storage.objects;

create policy "task_photos_select_pair"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and public.is_uuid_text((storage.foldername(name))[1])
  and public.is_pair_member(((storage.foldername(name))[1])::uuid)
);

create policy "task_photos_insert_pair_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and public.is_uuid_text((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_pair_member(((storage.foldername(name))[1])::uuid)
);

create policy "task_photos_delete_pair_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-photos'
  and public.is_uuid_text((storage.foldername(name))[1])
  and public.is_pair_member(((storage.foldername(name))[1])::uuid)
);
