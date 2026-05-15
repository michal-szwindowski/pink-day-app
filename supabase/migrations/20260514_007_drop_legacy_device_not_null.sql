alter table public.task_submissions alter column device_id drop not null;
alter table public.reward_redemptions alter column device_id drop not null;
alter table public.point_transactions alter column device_id drop not null;
