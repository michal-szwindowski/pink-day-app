alter table public.pair_members
  add column if not exists partner_nickname text;

drop function if exists public.update_partner_nickname(uuid, uuid, text);
create or replace function public.update_partner_nickname(
  p_pair_id uuid,
  p_profile_id uuid,
  p_partner_nickname text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_profile(p_profile_id) then
    raise exception 'Mozesz zmieniac pseudonim tylko ze swojego profilu.';
  end if;

  if not public.is_pair_member(p_pair_id, p_profile_id) then
    raise exception 'Nie jestes czlonkiem tej pary.';
  end if;

  update public.pair_members
  set partner_nickname = nullif(trim(p_partner_nickname), '')
  where pair_id = p_pair_id
    and profile_id = p_profile_id;

  return 'ok';
end;
$$;

grant execute on function public.update_partner_nickname(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
