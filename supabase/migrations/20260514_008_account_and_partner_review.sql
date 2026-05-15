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
    raise exception 'Nie możesz rozpatrywać własnego zgłoszenia.';
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
