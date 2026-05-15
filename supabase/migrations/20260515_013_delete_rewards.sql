drop policy if exists "rewards_pair_delete" on public.rewards;
create policy "rewards_pair_delete"
on public.rewards
for delete
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

notify pgrst, 'reload schema';
