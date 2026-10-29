-- Applied in Supabase; pgcrypto lives in extensions, not default search_path.
create or replace function private.cwl_issue_short_invite(p_clan uuid,p_role text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
        v_code text;
begin
 if v_user is null or not exists(select 1 from public.cwl_clans where id=p_clan and owner_user_id=v_user) then
   raise exception 'Only owner may invite' using errcode='42501';
 end if;
 if p_role not in ('editor','viewer') then raise exception 'Invalid role' using errcode='22023';end if;
 v_code := translate(rtrim(encode(extensions.gen_random_bytes(9),'base64'),'='),'+/','-_');
 insert into public.cwl_clan_invites(clan_id,created_by,role,expires_at,short_code_hash)
 values (p_clan,v_user,p_role,now()+interval '7 days',encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex'));
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_short_invite(uuid,text) from public;
grant execute on function private.cwl_issue_short_invite(uuid,text) to authenticated;
