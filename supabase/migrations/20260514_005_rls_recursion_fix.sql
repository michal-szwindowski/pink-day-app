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
