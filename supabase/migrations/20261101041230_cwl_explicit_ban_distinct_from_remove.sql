create function private.cwl_ban_clan_member(p_clan uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 perform private.cwl_kick_clan_member(p_clan,p_user);
 update public.cwl_access_blocks set permanent=true where clan_id=p_clan and user_id=p_user;
end;
$$;
revoke all on function private.cwl_ban_clan_member(uuid,uuid) from public,anon;
grant execute on function private.cwl_ban_clan_member(uuid,uuid) to authenticated;
create function public.cwl_ban_clan_member(p_clan uuid,p_user uuid)
returns void language sql security invoker set search_path=''
as $$ select private.cwl_ban_clan_member(p_clan,p_user) $$;
revoke all on function public.cwl_ban_clan_member(uuid,uuid) from public,anon;
grant execute on function public.cwl_ban_clan_member(uuid,uuid) to authenticated;
