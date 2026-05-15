create or replace function public.review_submission(
  p_action text,
  p_admin_device_id uuid,
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
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji.';
  end if;

  if p_action not in ('approve', 'reject', 'reset') then
    raise exception 'Nieprawidłowa akcja.';
  end if;

  if not public.owns_device(p_admin_device_id) or not public.is_current_admin() then
    raise exception 'Brak uprawnień administratora.';
  end if;

  select * into v_submission
  from public.task_submissions
  where id = p_submission_id
    and pair_id = 'main'
  for update;

  if v_submission.id is null then
    raise exception 'Nie znaleziono zgłoszenia.';
  end if;

  select * into v_task
  from public.tasks
  where id = v_submission.task_id;

  if p_action = 'approve' then
    if v_submission.status <> 'pending' then
      raise exception 'To zgłoszenie zostało już wcześniej rozpatrzone.';
    end if;

    update public.task_submissions
    set
      status = 'approved',
      rejection_reason = null,
      reviewed_at = now(),
      reviewed_by = p_admin_device_id,
      points_awarded = v_task.points
    where id = p_submission_id;

    insert into public.point_transactions (
      pair_id,
      device_id,
      amount,
      reason,
      submission_id,
      note
    )
    values (
      'main',
      v_submission.device_id,
      v_task.points,
      'task_approved',
      v_submission.id,
      v_task.title
    );

    return 'approved';
  end if;

  if p_action = 'reset' then
    if v_submission.status = 'pending' then
      raise exception 'To zgłoszenie już oczekuje na decyzję.';
    end if;

    if v_submission.status = 'approved' then
      delete from public.point_transactions
      where submission_id = v_submission.id
        and reason = 'task_approved';
    end if;

    update public.task_submissions
    set
      status = 'pending',
      rejection_reason = null,
      reviewed_at = null,
      reviewed_by = null,
      points_awarded = 0
    where id = p_submission_id;

    return 'reset';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'To zgłoszenie zostało już wcześniej rozpatrzone.';
  end if;

  if coalesce(trim(p_rejection_reason), '') = '' then
    raise exception 'Powód odrzucenia jest wymagany.';
  end if;

  update public.task_submissions
  set
    status = 'rejected',
    rejection_reason = trim(p_rejection_reason),
    reviewed_at = now(),
    reviewed_by = p_admin_device_id,
    points_awarded = 0
  where id = p_submission_id;

  return 'rejected';
end;
$$;
