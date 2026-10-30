-- Already applied on the connected Supabase project. Do not execute twice.
create or replace function private.cwl_issue_short_invite(p_clan uuid,p_role text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid := auth.uid();
 v_code text;
begin
 if v_user is null or not exists(
   select 1 from public.cwl_clan_memberships
   where clan_id=p_clan and user_id=v_user and role in ('owner','editor')
 ) then raise exception 'Only clan leaders may invite' using errcode='42501'; end if;
 if p_role not in ('editor','viewer') then raise exception 'Invalid invitation role' using errcode='22023'; end if;
 v_code:=translate(rtrim(encode(extensions.gen_random_bytes(9),'base64'),'='),'+/','-_');
 insert into public.cwl_clan_invites(clan_id,created_by,role,expires_at,short_code_hash)
 values (p_clan,v_user,p_role,now()+interval '7 days',encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex'));
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_short_invite(uuid,text) from public;
grant execute on function private.cwl_issue_short_invite(uuid,text) to authenticated;

create function private.cwl_accept_named_invite(p_code text,p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid:=auth.uid();
 v_row public.cwl_clan_invites%rowtype;
 v_name text:=btrim(p_name);
begin
 if v_user is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{12}$' then
   raise exception 'Invalid invitation' using errcode='22023'; end if;
 if v_name is null or length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then
   raise exception 'Ingame name required (1-60 characters)' using errcode='22023'; end if;
 select * into v_row from public.cwl_clan_invites
  where short_code_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex')
  and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitation expired or invalid' using errcode='22023'; end if;
 if exists(select 1 from public.cwl_clan_memberships
   where clan_id=v_row.clan_id and user_id=v_user) then
   raise exception 'You already belong to this clan' using errcode='22023'; end if;
 insert into public.cwl_clan_memberships(clan_id,user_id,role,display_name)
 values (v_row.clan_id,v_user,v_row.role,v_name);
 update public.cwl_clan_invites set used_at=now(),used_by=v_user where id=v_row.id;
 return v_row.clan_id;
end;
$$;
revoke all on function private.cwl_accept_named_invite(text,text) from public;
grant execute on function private.cwl_accept_named_invite(text,text) to authenticated;
create function public.cwl_redeem_named_invite(p_code text,p_name text)
returns uuid language sql security invoker set search_path=''
as $$select private.cwl_accept_named_invite(p_code,p_name)$$;
revoke all on function public.cwl_redeem_named_invite(text,text) from public,anon;
grant execute on function public.cwl_redeem_named_invite(text,text) to authenticated;

-- Disable the old short-link endpoint, which did not require a display name.
revoke execute on function public.cwl_redeem_short_invite(text) from public,anon,authenticated;
revoke execute on function private.cwl_accept_short_invite(text) from public,anon,authenticated;

-- Editors can inspect only the invitation status within their own clan.
create policy cwl_invites_editor_read on public.cwl_clan_invites for select to authenticated
 using (private.cwl_can_edit(clan_id));
