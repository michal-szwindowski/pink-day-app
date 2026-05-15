alter table public.allowed_users drop constraint if exists allowed_users_role_check;
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.allowed_users
  add constraint allowed_users_role_check check (role in ('owner', 'admin', 'member'));

alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'admin', 'member'));

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

create or replace function public.is_current_access_manager()
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
      and profiles.role in ('owner', 'admin')
  );
$$;

create or replace function public.prevent_admin_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_current_admin()
    and old.role = 'owner'
    and (
      tg_op = 'DELETE'
      or (
        tg_op = 'UPDATE'
        and (new.role <> 'owner' or new.active = false)
      )
    ) then
    raise exception 'Admin nie może odebrać roli ownera.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_admin_owner_loss_allowed_users_trigger on public.allowed_users;
create trigger prevent_admin_owner_loss_allowed_users_trigger
before update or delete on public.allowed_users
for each row
execute function public.prevent_admin_owner_loss();

drop trigger if exists prevent_admin_owner_loss_profiles_trigger on public.profiles;
create trigger prevent_admin_owner_loss_profiles_trigger
before update or delete on public.profiles
for each row
execute function public.prevent_admin_owner_loss();

create or replace function public.sync_profile_from_allowed_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    display_name = coalesce(new.display_name, public.profiles.display_name),
    role = new.role,
    active = new.active,
    updated_at = timezone('utc', now())
  where email = new.email;

  return new;
end;
$$;

drop trigger if exists sync_profile_from_allowed_user_trigger on public.allowed_users;
create trigger sync_profile_from_allowed_user_trigger
after insert or update on public.allowed_users
for each row
execute function public.sync_profile_from_allowed_user();

drop policy if exists "profiles_select_own_or_owner" on public.profiles;
drop policy if exists "profiles_select_own_or_access_manager" on public.profiles;
create policy "profiles_select_own_or_access_manager"
on public.profiles
for select
to authenticated
using (public.is_current_access_manager() or auth_user_id = auth.uid());

drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "profiles_access_manager_update" on public.profiles;
create policy "profiles_access_manager_update"
on public.profiles
for update
to authenticated
using (public.is_current_access_manager())
with check (public.is_current_access_manager());

drop policy if exists "allowed_users_owner_select" on public.allowed_users;
drop policy if exists "allowed_users_access_manager_select" on public.allowed_users;
create policy "allowed_users_access_manager_select"
on public.allowed_users
for select
to authenticated
using (public.is_current_access_manager());

drop policy if exists "allowed_users_owner_insert" on public.allowed_users;
drop policy if exists "allowed_users_access_manager_insert" on public.allowed_users;
create policy "allowed_users_access_manager_insert"
on public.allowed_users
for insert
to authenticated
with check (public.is_current_access_manager());

drop policy if exists "allowed_users_owner_update" on public.allowed_users;
drop policy if exists "allowed_users_access_manager_update" on public.allowed_users;
create policy "allowed_users_access_manager_update"
on public.allowed_users
for update
to authenticated
using (public.is_current_access_manager())
with check (public.is_current_access_manager());

drop policy if exists "allowed_users_owner_delete" on public.allowed_users;
drop policy if exists "allowed_users_access_manager_delete" on public.allowed_users;
create policy "allowed_users_access_manager_delete"
on public.allowed_users
for delete
to authenticated
using (public.is_current_access_manager());

notify pgrst, 'reload schema';
