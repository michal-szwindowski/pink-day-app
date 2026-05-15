alter table public.tasks
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists target_profile_id uuid references public.profiles(id) on delete cascade;

alter table public.rewards
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists target_profile_id uuid references public.profiles(id) on delete cascade;

update public.tasks tasks
set
  created_by_profile_id = pairs.created_by_profile_id,
  target_profile_id = partners.profile_id
from public.pairs pairs
join lateral (
  select members.profile_id
  from public.pair_members members
  where members.pair_id = pairs.id
    and members.profile_id <> pairs.created_by_profile_id
  order by members.created_at
  limit 1
) partners on true
where tasks.pair_id = pairs.id::text
  and (tasks.created_by_profile_id is null or tasks.target_profile_id is null);

update public.rewards rewards
set
  created_by_profile_id = pairs.created_by_profile_id,
  target_profile_id = partners.profile_id
from public.pairs pairs
join lateral (
  select members.profile_id
  from public.pair_members members
  where members.pair_id = pairs.id
    and members.profile_id <> pairs.created_by_profile_id
  order by members.created_at
  limit 1
) partners on true
where rewards.pair_id = pairs.id::text
  and (rewards.created_by_profile_id is null or rewards.target_profile_id is null);

create index if not exists tasks_target_profile_idx
  on public.tasks (target_profile_id, pair_id, active);

create index if not exists tasks_created_by_profile_idx
  on public.tasks (created_by_profile_id, pair_id);

create index if not exists rewards_target_profile_idx
  on public.rewards (target_profile_id, pair_id, active);

create index if not exists rewards_created_by_profile_idx
  on public.rewards (created_by_profile_id, pair_id);

drop policy if exists "profiles_select_pair_member_profile" on public.profiles;
create policy "profiles_select_pair_member_profile"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.pair_members their_membership
    join public.pair_members my_membership on my_membership.pair_id = their_membership.pair_id
    join public.pairs pairs on pairs.id = their_membership.pair_id
    where their_membership.profile_id = profiles.id
      and my_membership.profile_id = public.current_profile_id()
      and pairs.active = true
  )
);

drop policy if exists "tasks_pair_insert" on public.tasks;
create policy "tasks_pair_insert"
on public.tasks
for insert
to authenticated
with check (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
  and target_profile_id <> created_by_profile_id
  and public.is_pair_member(pair_id::uuid, target_profile_id)
);

drop policy if exists "tasks_pair_update" on public.tasks;
create policy "tasks_pair_update"
on public.tasks
for update
to authenticated
using (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
)
with check (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
  and target_profile_id <> created_by_profile_id
  and public.is_pair_member(pair_id::uuid, target_profile_id)
);

drop policy if exists "tasks_pair_delete" on public.tasks;
create policy "tasks_pair_delete"
on public.tasks
for delete
to authenticated
using (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
);

drop policy if exists "rewards_pair_insert" on public.rewards;
create policy "rewards_pair_insert"
on public.rewards
for insert
to authenticated
with check (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
  and target_profile_id <> created_by_profile_id
  and public.is_pair_member(pair_id::uuid, target_profile_id)
);

drop policy if exists "rewards_pair_update" on public.rewards;
create policy "rewards_pair_update"
on public.rewards
for update
to authenticated
using (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
)
with check (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
  and target_profile_id <> created_by_profile_id
  and public.is_pair_member(pair_id::uuid, target_profile_id)
);

drop policy if exists "rewards_pair_delete" on public.rewards;
create policy "rewards_pair_delete"
on public.rewards
for delete
to authenticated
using (
  public.is_uuid_text(pair_id)
  and public.is_pair_member(pair_id::uuid)
  and created_by_profile_id = public.current_profile_id()
);

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
  and exists (
    select 1
    from public.tasks
    where tasks.id = task_id
      and tasks.pair_id = task_submissions.pair_id
      and (tasks.target_profile_id is null or tasks.target_profile_id = public.current_profile_id())
  )
);

drop function if exists public.review_submission(text, uuid, uuid, text);
drop function if exists public.review_submission(text, uuid, uuid);
drop function if exists public.review_submission(text, uuid, text, uuid);
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
    raise exception 'Nie znaleziono zgloszenia.';
  end if;

  if not public.owns_profile(p_reviewer_profile_id)
    or not public.is_pair_member(v_submission.pair_id::uuid, p_reviewer_profile_id) then
    raise exception 'Tylko osoba z tej pary moze rozpatrywac zgloszenia.';
  end if;

  if v_submission.profile_id = p_reviewer_profile_id then
    raise exception 'Nie mozesz rozpatrywac wlasnego zgloszenia.';
  end if;

  select * into v_task from public.tasks where id = v_submission.task_id;

  if v_task.created_by_profile_id is not null and v_task.created_by_profile_id <> p_reviewer_profile_id then
    raise exception 'Tylko osoba, ktora ustawila to zadanie, moze je rozpatrzyc.';
  end if;

  if v_task.target_profile_id is not null and v_task.target_profile_id <> v_submission.profile_id then
    raise exception 'To zadanie nie bylo ustawione dla osoby, ktora wyslala zgloszenie.';
  end if;

  if p_action = 'approve' then
    if v_submission.status = 'approved' then
      raise exception 'To zgloszenie jest juz zaakceptowane.';
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
      raise exception 'Powod odrzucenia jest wymagany.';
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

  raise exception 'Nieznana akcja: %', p_action;
end;
$$;

drop function if exists public.request_reward_redemption(uuid, uuid, uuid);
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
    raise exception 'Mozesz odbierac nagrody tylko w swojej parze.';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
    and pair_id = p_pair_id::text
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnej nagrody.';
  end if;

  if v_reward.target_profile_id is not null and v_reward.target_profile_id <> p_profile_id then
    raise exception 'Ta nagroda nie jest ustawiona dla Ciebie.';
  end if;

  v_balance := public.current_balance_for_profile(p_profile_id, p_pair_id::text);
  if v_balance < v_reward.cost then
    raise exception 'Za malo punktow.';
  end if;

  insert into public.reward_redemptions (pair_id, profile_id, reward_id, reward_title, cost, status)
  values (p_pair_id::text, p_profile_id, v_reward.id, v_reward.title, v_reward.cost, 'requested')
  returning id into v_redemption_id;

  insert into public.point_transactions (pair_id, profile_id, amount, reason, reward_redemption_id, note)
  values (p_pair_id::text, p_profile_id, -v_reward.cost, 'reward_redeemed', v_redemption_id, v_reward.title);

  return v_redemption_id;
end;
$$;

drop function if exists public.seed_defaults(uuid, uuid);
create or replace function public.seed_defaults(p_pair_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_profile_id uuid;
begin
  if not public.owns_profile(p_profile_id) or not public.is_pair_member(p_pair_id, p_profile_id) then
    raise exception 'Tylko osoba z tej pary moze dodac dane startowe.';
  end if;

  select members.profile_id
  into v_target_profile_id
  from public.pair_members members
  where members.pair_id = p_pair_id
    and members.profile_id <> p_profile_id
  order by members.created_at
  limit 1;

  if v_target_profile_id is null then
    raise exception 'Nie znaleziono drugiej osoby w parze.';
  end if;

  if not exists (
    select 1
    from public.tasks
    where pair_id = p_pair_id::text
      and created_by_profile_id = p_profile_id
      and target_profile_id = v_target_profile_id
  ) then
    insert into public.tasks (
      pair_id,
      created_by_profile_id,
      target_profile_id,
      title,
      description,
      points,
      type,
      date,
      requires_photo,
      active
    )
    values
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Wypij wode', null, 5, 'daily', null, false, true),
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Spacer', null, 10, 'daily', null, false, true),
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Trening', null, 20, 'daily', null, true, true);
  end if;

  if not exists (
    select 1
    from public.rewards
    where pair_id = p_pair_id::text
      and created_by_profile_id = p_profile_id
      and target_profile_id = v_target_profile_id
  ) then
    insert into public.rewards (
      pair_id,
      created_by_profile_id,
      target_profile_id,
      title,
      description,
      cost,
      active
    )
    values
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Wybor filmu', null, 30, true),
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Masaz', null, 50, true),
      (p_pair_id::text, p_profile_id, v_target_profile_id, 'Randka-niespodzianka', null, 100, true);
  end if;

  return 'ok';
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

  insert into public.tasks (
    pair_id,
    created_by_profile_id,
    target_profile_id,
    title,
    description,
    points,
    type,
    date,
    requires_photo,
    active
  )
  values
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Wypij wode', null, 5, 'daily', null, false, true),
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Spacer', null, 10, 'daily', null, false, true),
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Trening', null, 20, 'daily', null, true, true);

  insert into public.rewards (
    pair_id,
    created_by_profile_id,
    target_profile_id,
    title,
    description,
    cost,
    active
  )
  values
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Wybor filmu', null, 30, true),
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Masaz', null, 50, true),
    (v_pair_id::text, v_request.requester_profile_id, v_request.recipient_profile_id, 'Randka-niespodzianka', null, 100, true);

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

grant execute on function public.review_submission(text, uuid, uuid, text) to authenticated;
grant execute on function public.request_reward_redemption(uuid, uuid, uuid) to authenticated;
grant execute on function public.seed_defaults(uuid, uuid) to authenticated;
grant execute on function public.respond_pair_request(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
