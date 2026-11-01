-- Reusable, revocable invitation links; keep the existing 12-character single-use links unchanged.
alter table public.cwl_clan_invites
  add column reusable boolean not null default false;
alter table public.cwl_clan_invites
  alter column expires_at drop not null;
alter table public.cwl_clan_invites
  drop constraint invite_lifetime;
alter table public.cwl_clan_invites
  add constraint invite_lifetime check (
    (reusable = true and expires_at is null and used_at is null)
    or
    (reusable = false and expires_at is not null and
     expires_at > created_at and expires_at <= created_at + interval '30 days')
  );

create function private.cwl_issue_reusable_invite(p_clan uuid,p_role text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid:=auth.uid();
 v_code text;
begin
 if v_user is null or not exists (
   select 1 from public.cwl_clan_memberships
   where clan_id=p_clan and user_id=v_user and role in ('owner','editor')
 ) then raise exception 'Only clan leaders may invite' using errcode='42501'; end if;
 if p_role not in ('editor','viewer') then
   raise exception 'Invalid invitation role' using errcode='22023'; end if;
 -- 144-bit, URL-safe capability token, stored only as SHA-256 hash.
 v_code:=translate(rtrim(encode(extensions.gen_random_bytes(18),'base64'),'='),'+/','-_');
 insert into public.cwl_clan_invites(clan_id,created_by,role,expires_at,short_code_hash,reusable)
 values(p_clan,v_user,p_role,null,encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex'),true);
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_reusable_invite(uuid,text) from public,anon,authenticated;
create function public.cwl_create_reusable_invite(p_clan uuid,p_role text)
returns text language sql security invoker set search_path = ''
as $$select private.cwl_issue_reusable_invite(p_clan,p_role)$$;
revoke all on function public.cwl_create_reusable_invite(uuid,text) from public,anon;
grant execute on function public.cwl_create_reusable_invite(uuid,text) to authenticated;

create function private.cwl_accept_reusable_invite(p_code text,p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid:=auth.uid();
 v_clan uuid;
 v_role text;
 v_name text:=btrim(p_name);
begin
 if v_user is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{24}$' then
   raise exception 'Invalid invitation' using errcode='22023'; end if;
 if v_name is null or length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then
   raise exception 'Ingame name required (1-60 characters)' using errcode='22023'; end if;
 select clan_id,role into v_clan,v_role from public.cwl_clan_invites
 where short_code_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex')
   and reusable=true and expires_at is null and used_at is null;
 if v_clan is null then raise exception 'Invitation revoked or invalid' using errcode='22023'; end if;
 -- Existing membership retains its role; a link cannot silently upgrade it.
 insert into public.cwl_clan_memberships(clan_id,user_id,role,display_name)
 values(v_clan,v_user,v_role,v_name)
 on conflict (clan_id,user_id) do nothing;
 return v_clan;
end;
$$;
revoke all on function private.cwl_accept_reusable_invite(text,text) from public,anon,authenticated;
create function public.cwl_redeem_reusable_invite(p_code text,p_name text)
returns uuid language sql security invoker set search_path = ''
as $$select private.cwl_accept_reusable_invite(p_code,p_name)$$;
revoke all on function public.cwl_redeem_reusable_invite(text,text) from public,anon;
grant execute on function public.cwl_redeem_reusable_invite(text,text) to authenticated;

