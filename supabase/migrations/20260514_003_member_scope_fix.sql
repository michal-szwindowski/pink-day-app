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

drop policy if exists "submissions_select_own_or_admin" on public.task_submissions;
create policy "submissions_select_own_or_admin"
on public.task_submissions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));

drop policy if exists "submission_photos_select" on public.submission_photos;
create policy "submission_photos_select"
on public.submission_photos
for select
to authenticated
using (public.can_access_member_submission(submission_id));

drop policy if exists "redemptions_select_own_or_admin" on public.reward_redemptions;
create policy "redemptions_select_own_or_admin"
on public.reward_redemptions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));

drop policy if exists "transactions_select_own_or_admin" on public.point_transactions;
create policy "transactions_select_own_or_admin"
on public.point_transactions
for select
to authenticated
using (pair_id = 'main' and public.can_access_member_device(device_id));
