create or replace function public.generate_profile_invite_code()
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
    exit when not exists (select 1 from public.profiles where invite_code = v_code);
  end loop;

  return v_code;
end;
$$;

alter table public.profiles
  add column if not exists invite_code text;

alter table public.profiles
  alter column invite_code set default public.generate_profile_invite_code();

update public.profiles
set invite_code = public.generate_profile_invite_code()
where invite_code is null;

create unique index if not exists profiles_invite_code_unique
  on public.profiles (invite_code);

create or replace function public.profile_has_active_pair(p_profile_id uuid)
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
    where members.profile_id = p_profile_id
      and pairs.active = true
  );
$$;

drop function if exists public.join_pair_by_code(text, uuid);
create or replace function public.join_pair_by_code(p_invite_code text, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.profiles%rowtype;
  v_pair_id uuid;
  v_pair_code text;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Mozesz laczyc sie w pare tylko swoim profilem.';
  end if;

  select *
  into v_partner
  from public.profiles
  where invite_code = upper(trim(p_invite_code))
    and active = true;

  if not found then
    raise exception 'Nie znaleziono osoby z takim kodem.';
  end if;

  if v_partner.id = p_profile_id then
    raise exception 'Nie mozesz polaczyc sie sam ze soba.';
  end if;

  if public.profile_has_active_pair(p_profile_id) then
    raise exception 'Masz juz aktywna pare. Najpierw odlacz sie od obecnej pary.';
  end if;

  if public.profile_has_active_pair(v_partner.id) then
    raise exception 'Ta osoba ma juz aktywna pare.';
  end if;

  v_pair_code := public.generate_pair_code();

  insert into public.pairs (name, invite_code, created_by_profile_id)
  values ('Wasza para', v_pair_code, p_profile_id)
  returning id into v_pair_id;

  insert into public.pair_members (pair_id, profile_id)
  values
    (v_pair_id, p_profile_id),
    (v_pair_id, v_partner.id);

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

  return v_pair_id;
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
    raise exception 'Mozesz opuscic pare tylko swoim profilem.';
  end if;

  if not public.is_pair_member(p_pair_id, p_profile_id) then
    raise exception 'Nie jestes czlonkiem tej pary.';
  end if;

  update public.pairs
  set active = false
  where id = p_pair_id;

  delete from public.pair_members
  where pair_id = p_pair_id;

  return 'left';
end;
$$;

grant execute on function public.join_pair_by_code(text, uuid) to authenticated;
grant execute on function public.leave_pair(uuid, uuid) to authenticated;
grant execute on function public.generate_profile_invite_code() to authenticated;

notify pgrst, 'reload schema';
