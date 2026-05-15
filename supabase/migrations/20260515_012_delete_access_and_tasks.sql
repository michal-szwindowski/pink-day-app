create or replace function public.prevent_last_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active = true
    and old.role = 'owner'
    and public.active_owner_count() <= 1 then
    raise exception 'Aplikacja musi miec przynajmniej jednego aktywnego ownera.';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_last_owner_delete_trigger on public.allowed_users;
create trigger prevent_last_owner_delete_trigger
before delete on public.allowed_users
for each row
execute function public.prevent_last_owner_delete();

drop policy if exists "allowed_users_owner_delete" on public.allowed_users;
create policy "allowed_users_owner_delete"
on public.allowed_users
for delete
to authenticated
using (public.is_current_owner());

drop policy if exists "tasks_pair_delete" on public.tasks;
create policy "tasks_pair_delete"
on public.tasks
for delete
to authenticated
using (public.is_uuid_text(pair_id) and public.is_pair_member(pair_id::uuid));

notify pgrst, 'reload schema';
