alter table public.task_submissions alter column device_id drop not null;
alter table public.reward_redemptions alter column device_id drop not null;
alter table public.point_transactions alter column device_id drop not null;

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

drop policy if exists "pair_members_delete_self" on public.pair_members;
create policy "pair_members_delete_self"
on public.pair_members
for delete
to authenticated
using (profile_id = public.current_profile_id());

grant execute on function public.review_submission(text, uuid, uuid, text) to authenticated;
grant execute on function public.leave_pair(uuid, uuid) to authenticated;
grant execute on function public.update_profile_display_name(uuid, text) to authenticated;

notify pgrst, 'reload schema';
