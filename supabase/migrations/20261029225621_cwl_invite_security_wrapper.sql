-- Existing migration exported from Supabase; do not re-apply to this project.
create function private.cwl_redeem_invite_internal(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.cwl_clan_invites%rowtype;
  v_inserted int := 0;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.cwl_clan_invites
   where id = p_invite_id and used_at is null and expires_at > now() for update;
  if not found then raise exception 'Invitation invalid or expired' using errcode = '22023'; end if;
  insert into public.cwl_clan_memberships (clan_id, user_id, role)
    values (v_invite.clan_id, v_user_id, v_invite.role)
    on conflict (clan_id,user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.cwl_clan_invites set used_at = now(), used_by = v_user_id where id = v_invite.id;
  end if;
  return v_invite.clan_id;
end;
$$;
revoke all on function private.cwl_redeem_invite_internal(uuid) from public;
grant execute on function private.cwl_redeem_invite_internal(uuid) to authenticated;

create or replace function public.cwl_redeem_invite(p_invite_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.cwl_redeem_invite_internal(p_invite_id) $$;
revoke all on function public.cwl_redeem_invite(uuid) from public, anon;
grant execute on function public.cwl_redeem_invite(uuid) to authenticated;
