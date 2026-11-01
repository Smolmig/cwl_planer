-- Reusable clan invitation links: 24 hours, 7 days or no expiry.
-- Existing seven-day, single-use invites remain unchanged.
alter table public.cwl_clan_invites
  add column if not exists link_label text,
  add column if not exists use_count integer not null default 0;
alter table public.cwl_clan_invites drop constraint if exists invite_lifetime;
alter table public.cwl_clan_invites add constraint invite_lifetime check (
 (reusable=true and used_at is null and
   (expires_at is null or (expires_at>created_at and expires_at<=created_at+interval '7 days')))
 or (reusable=false and expires_at is not null
   and expires_at>created_at and expires_at<=created_at+interval '30 days')
);
alter table public.cwl_clan_invites add constraint invite_link_label_valid
 check (link_label is null or (char_length(btrim(link_label)) between 1 and 60 and link_label !~ '[[:cntrl:]]'));
alter table public.cwl_clan_invites add constraint invite_use_count_valid check (use_count>=0);

create or replace function private.cwl_issue_reusable_invite(
 p_clan uuid,p_role text,p_duration text,p_label text default null
) returns text language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_code text;
 v_expires timestamptz;
 v_label text:=nullif(btrim(p_label),'');
begin
 if v_user is null or not exists(
  select 1 from public.cwl_clan_memberships
  where clan_id=p_clan and user_id=v_user and role in ('owner','editor')
 ) then raise exception 'Only clan leaders may invite' using errcode='42501'; end if;
 if p_role not in ('editor','viewer') then
  raise exception 'Invalid invitation role' using errcode='22023'; end if;
 if p_duration not in ('24h','7d','never') then
  raise exception 'Invalid invitation duration' using errcode='22023'; end if;
 if v_label is not null and (char_length(v_label)>60 or v_label ~ '[[:cntrl:]]') then
  raise exception 'Invalid invitation label' using errcode='22023'; end if;
 if p_duration='24h' then v_expires:=now()+interval '24 hours';
 elsif p_duration='7d' then v_expires:=now()+interval '7 days';
 else v_expires:=null;
 end if;
 -- 144 random bits; only the SHA-256 hash enters storage.
 v_code:=translate(rtrim(encode(extensions.gen_random_bytes(18),'base64'),'='),'+/','-_');
 insert into public.cwl_clan_invites(clan_id,created_by,role,expires_at,short_code_hash,reusable,link_label)
 values(p_clan,v_user,p_role,v_expires,encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex'),true,v_label);
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_reusable_invite(uuid,text,text,text) from public,anon;
grant execute on function private.cwl_issue_reusable_invite(uuid,text,text,text) to authenticated;

create or replace function public.cwl_create_reusable_invite(
 p_clan uuid,p_role text,p_duration text,p_label text default null
) returns text language sql security invoker set search_path=''
as $$ select private.cwl_issue_reusable_invite(p_clan,p_role,p_duration,p_label) $$;
revoke all on function public.cwl_create_reusable_invite(uuid,text,text,text) from public,anon;
grant execute on function public.cwl_create_reusable_invite(uuid,text,text,text) to authenticated;

create or replace function private.cwl_accept_reusable_invite(p_code text,p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_row public.cwl_clan_invites%rowtype;
 v_name text:=btrim(p_name);
 v_added integer:=0;
begin
 if v_user is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{24}$' then
  raise exception 'Invalid invitation' using errcode='22023'; end if;
 if v_name is null or char_length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then
  raise exception 'Ingame name required (1-60 characters)' using errcode='22023'; end if;
 select * into v_row from public.cwl_clan_invites
 where short_code_hash=encode(pg_catalog.sha256(convert_to(p_code,'UTF8')),'hex')
   and reusable=true and used_at is null
   and (expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'Invitation expired, revoked or invalid' using errcode='22023'; end if;
 -- Never upgrade an existing member's role by visiting a link.
 insert into public.cwl_clan_memberships(clan_id,user_id,role,display_name)
 values(v_row.clan_id,v_user,v_row.role,v_name)
 on conflict (clan_id,user_id) do nothing;
 get diagnostics v_added=row_count;
 if v_added>0 then
  update public.cwl_clan_invites set use_count=use_count+1 where id=v_row.id;
 end if;
 return v_row.clan_id;
end;
$$;
revoke all on function private.cwl_accept_reusable_invite(text,text) from public,anon;
grant execute on function private.cwl_accept_reusable_invite(text,text) to authenticated;
-- Existing public.cwl_redeem_reusable_invite(text,text) wrapper remains valid.

