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
  v_profile public.profiles%rowtype;
  v_has_allowed_user boolean := false;
  v_should_bootstrap_owner boolean := false;
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
  limit 1;

  v_has_allowed_user := found;
  v_should_bootstrap_owner :=
    not v_has_allowed_user
    and v_email = lower(p_admin_email)
    and not exists (select 1 from public.allowed_users);

  if v_has_allowed_user and v_allowed.active = true then
    insert into public.profiles (auth_user_id, email, role, display_name, active)
    values (
      auth.uid(),
      v_email,
      v_allowed.role,
      coalesce(
        v_allowed.display_name,
        v_auth_user.raw_user_meta_data ->> 'full_name',
        v_auth_user.raw_user_meta_data ->> 'name',
        split_part(v_email, '@', 1)
      ),
      true
    )
    on conflict (auth_user_id) do update
    set
      email = excluded.email,
      role = excluded.role,
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      active = true,
      updated_at = timezone('utc', now())
    returning * into v_profile;

    return jsonb_build_object('status', 'ready', 'profile_id', v_profile.id, 'role', v_profile.role);
  end if;

  if v_should_bootstrap_owner then
    insert into public.profiles (auth_user_id, email, role, display_name, active)
    values (
      auth.uid(),
      v_email,
      'owner',
      coalesce(
        v_auth_user.raw_user_meta_data ->> 'full_name',
        v_auth_user.raw_user_meta_data ->> 'name',
        split_part(v_email, '@', 1)
      ),
      true
    )
    on conflict (auth_user_id) do update
    set
      email = excluded.email,
      role = 'owner',
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      active = true,
      updated_at = timezone('utc', now())
    returning * into v_profile;

    insert into public.allowed_users (email, display_name, role, active, invited_by)
    values (v_email, v_profile.display_name, 'owner', true, v_profile.id);

    return jsonb_build_object('status', 'ready', 'profile_id', v_profile.id, 'role', v_profile.role);
  end if;

  update public.profiles
  set active = false, updated_at = timezone('utc', now())
  where auth_user_id = auth.uid();

  return jsonb_build_object('status', 'no_access', 'email', v_email);
end;
$$;

notify pgrst, 'reload schema';
