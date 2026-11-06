-- Backward-compatible invitation recovery (applied to Supabase on 2026-11-06).
-- Existing codes were stored only as hashes and cannot be recovered or changed.
-- Only codes created through cwl_create_copyable_invite are saved privately.
create table private.cwl_invite_link_secrets (
  invite_id uuid primary key references public.cwl_clan_invites(id) on delete cascade,
  invite_code text not null check (invite_code ~ '^[A-Za-z0-9_-]{12}([A-Za-z0-9_-]{12})?$')
);
alter table private.cwl_invite_link_secrets enable row level security;
revoke all on private.cwl_invite_link_secrets from public, anon, authenticated;

create function private.cwl_issue_copyable_invite(
 p_clan uuid, p_role text, p_reusable boolean, p_duration text, p_label text
) returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_code text;
 v_id uuid;
begin
 if auth.uid() is null then
   raise exception 'Login required' using errcode='42501';
 end if;
 if p_reusable is null then
   raise exception 'Invitation type required' using errcode='22023';
 end if;
 if p_reusable then
   v_code:=private.cwl_issue_reusable_invite(p_clan,p_role,p_duration,p_label);
 else
   v_code:=private.cwl_issue_short_invite(p_clan,p_role);
 end if;
 select i.id into v_id from public.cwl_clan_invites i
 where i.clan_id=p_clan and i.created_by=auth.uid()
   and i.short_code_hash=encode(pg_catalog.sha256(convert_to(v_code,'UTF8')),'hex');
 if v_id is null then raise exception 'Invitation could not be stored' using errcode='22023'; end if;
 insert into private.cwl_invite_link_secrets(invite_id,invite_code)
 values (v_id,v_code);
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_copyable_invite(uuid,text,boolean,text,text) from public,anon,authenticated;
grant execute on function private.cwl_issue_copyable_invite(uuid,text,boolean,text,text) to authenticated;

create function public.cwl_create_copyable_invite(
 p_clan uuid, p_role text, p_reusable boolean, p_duration text default '7d', p_label text default null
) returns text language sql security invoker set search_path = ''
as $$ select private.cwl_issue_copyable_invite(p_clan,p_role,p_reusable,p_duration,p_label) $$;
revoke all on function public.cwl_create_copyable_invite(uuid,text,boolean,text,text) from public,anon;
grant execute on function public.cwl_create_copyable_invite(uuid,text,boolean,text,text) to authenticated;

-- Reveal a secret only while its invite is active and the requester is the
-- clan owner or the editor who created it. Listing never includes secrets.
create function private.cwl_read_copyable_invite(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
 if auth.uid() is null then
   raise exception 'Login required' using errcode='42501';
 end if;
 select s.invite_code into v_code
 from private.cwl_invite_link_secrets s
 join public.cwl_clan_invites i on i.id=s.invite_id
 where i.id=p_id
   and i.used_at is null
   and (i.expires_at is null or i.expires_at>now())
   and exists (
     select 1 from public.cwl_clan_memberships m
     where m.clan_id=i.clan_id and m.user_id=auth.uid()
     and (m.role='owner' or (m.role='editor' and i.created_by=auth.uid()))
   );
 return v_code;
end;
$$;
revoke all on function private.cwl_read_copyable_invite(uuid) from public,anon,authenticated;
grant execute on function private.cwl_read_copyable_invite(uuid) to authenticated;

create function public.cwl_read_copyable_invite(p_id uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.cwl_read_copyable_invite(p_id) $$;
revoke all on function public.cwl_read_copyable_invite(uuid) from public,anon;
grant execute on function public.cwl_read_copyable_invite(uuid) to authenticated;
