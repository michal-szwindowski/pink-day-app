create table if not exists public.pair_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'canceled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint pair_requests_not_self check (requester_profile_id <> recipient_profile_id)
);

create index if not exists pair_requests_requester_idx
  on public.pair_requests (requester_profile_id, status, created_at desc);

create index if not exists pair_requests_recipient_idx
  on public.pair_requests (recipient_profile_id, status, created_at desc);

alter table public.pair_requests enable row level security;

drop policy if exists "profiles_select_pair_request_participant" on public.profiles;
create policy "profiles_select_pair_request_participant"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.pair_requests requests
    where requests.status = 'pending'
      and (
        (requests.requester_profile_id = profiles.id and public.owns_profile(requests.recipient_profile_id))
        or (requests.recipient_profile_id = profiles.id and public.owns_profile(requests.requester_profile_id))
      )
  )
);

drop policy if exists "pair_requests_select_participant" on public.pair_requests;
create policy "pair_requests_select_participant"
on public.pair_requests
for select
to authenticated
using (
  public.owns_profile(requester_profile_id)
  or public.owns_profile(recipient_profile_id)
);

drop function if exists public.request_pair_by_code(text, uuid);
create or replace function public.request_pair_by_code(p_invite_code text, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient public.profiles%rowtype;
  v_request_id uuid;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Mozesz wyslac prosbe tylko ze swojego profilu.';
  end if;

  select *
  into v_recipient
  from public.profiles
  where invite_code = upper(trim(p_invite_code))
    and active = true;

  if not found then
    raise exception 'Nie znaleziono osoby z takim kodem.';
  end if;

  if v_recipient.id = p_profile_id then
    raise exception 'Nie mozesz wyslac prosby sam do siebie.';
  end if;

  if public.profile_has_active_pair(p_profile_id) then
    raise exception 'Masz juz aktywna pare. Najpierw odlacz sie od obecnej pary.';
  end if;

  if public.profile_has_active_pair(v_recipient.id) then
    raise exception 'Ta osoba ma juz aktywna pare.';
  end if;

  select id
  into v_request_id
  from public.pair_requests
  where status = 'pending'
    and (
      (requester_profile_id = p_profile_id and recipient_profile_id = v_recipient.id)
      or (requester_profile_id = v_recipient.id and recipient_profile_id = p_profile_id)
    )
  limit 1;

  if found then
    return v_request_id;
  end if;

  insert into public.pair_requests (requester_profile_id, recipient_profile_id)
  values (p_profile_id, v_recipient.id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

drop function if exists public.respond_pair_request(uuid, uuid, text);
create or replace function public.respond_pair_request(
  p_request_id uuid,
  p_profile_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.pair_requests%rowtype;
  v_pair_id uuid;
  v_pair_code text;
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Mozesz odpowiadac tylko ze swojego profilu.';
  end if;

  if p_action not in ('accept', 'reject', 'cancel') then
    raise exception 'Nieznana akcja.';
  end if;

  select *
  into v_request
  from public.pair_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Nie znaleziono prosby.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Ta prosba nie jest juz aktywna.';
  end if;

  if p_action = 'cancel' then
    if v_request.requester_profile_id <> p_profile_id then
      raise exception 'Tylko nadawca moze anulowac prosbe.';
    end if;

    update public.pair_requests
    set status = 'canceled', responded_at = now()
    where id = p_request_id;

    return null;
  end if;

  if v_request.recipient_profile_id <> p_profile_id then
    raise exception 'Tylko odbiorca moze zaakceptowac albo odrzucic prosbe.';
  end if;

  if p_action = 'reject' then
    update public.pair_requests
    set status = 'rejected', responded_at = now()
    where id = p_request_id;

    return null;
  end if;

  if public.profile_has_active_pair(v_request.requester_profile_id) then
    raise exception 'Osoba zapraszajaca ma juz aktywna pare.';
  end if;

  if public.profile_has_active_pair(v_request.recipient_profile_id) then
    raise exception 'Masz juz aktywna pare.';
  end if;

  v_pair_code := public.generate_pair_code();

  insert into public.pairs (name, invite_code, created_by_profile_id)
  values ('Wasza para', v_pair_code, v_request.requester_profile_id)
  returning id into v_pair_id;

  insert into public.pair_members (pair_id, profile_id)
  values
    (v_pair_id, v_request.requester_profile_id),
    (v_pair_id, v_request.recipient_profile_id);

  insert into public.tasks (pair_id, title, description, points, type, date, requires_photo, active)
  values
    (v_pair_id::text, 'Wypij wode', null, 5, 'daily', null, false, true),
    (v_pair_id::text, 'Spacer', null, 10, 'daily', null, false, true),
    (v_pair_id::text, 'Trening', null, 20, 'daily', null, true, true);

  insert into public.rewards (pair_id, title, description, cost, active)
  values
    (v_pair_id::text, 'Wybor filmu', null, 30, true),
    (v_pair_id::text, 'Masaz', null, 50, true),
    (v_pair_id::text, 'Randka-niespodzianka', null, 100, true);

  update public.pair_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  update public.pair_requests
  set status = 'canceled', responded_at = now()
  where status = 'pending'
    and id <> p_request_id
    and (
      requester_profile_id in (v_request.requester_profile_id, v_request.recipient_profile_id)
      or recipient_profile_id in (v_request.requester_profile_id, v_request.recipient_profile_id)
    );

  return v_pair_id;
end;
$$;

grant execute on function public.request_pair_by_code(text, uuid) to authenticated;
grant execute on function public.respond_pair_request(uuid, uuid, text) to authenticated;

drop function if exists public.join_pair_by_code(text, uuid);
create or replace function public.join_pair_by_code(p_invite_code text, p_profile_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.request_pair_by_code(p_invite_code, p_profile_id);
$$;

grant execute on function public.join_pair_by_code(text, uuid) to authenticated;

notify pgrst, 'reload schema';
