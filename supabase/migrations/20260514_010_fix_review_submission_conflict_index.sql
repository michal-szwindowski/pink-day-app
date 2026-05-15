create unique index if not exists point_transactions_submission_task_approved_unique
  on public.point_transactions (submission_id, reason)
  where reason = 'task_approved';

notify pgrst, 'reload schema';
