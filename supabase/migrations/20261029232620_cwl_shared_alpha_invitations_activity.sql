-- Already applied to production Supabase; add to repository migration history.
-- Shared-cloud alpha: short one-time invite codes, change history and attribution.
alter table public.cwl_clan_invites
 add column short_code_hash text unique;

alter table public.cwl_clan_memberships
 add column display_name text check (display_name is null or length(btrim(display_name)) between 1 and 60);

create table public.cwl_change_events (
  id bigint generated always as identity primary key,
  clan_id uuid not null references public.cwl_clans(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  revision bigint not null,
  event_type text not null check (event_type in ('profile_created','profile_updated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index cwl_change_events_clan on public.cwl_change_events (clan_id, id desc);
alter table public.cwl_change_events enable row level security;
create policy cwl_change_events_members_read on public.cwl_change_events for select
 to authenticated using (private.cwl_is_member(clan_id));
revoke all on public.cwl_change_events from anon,authenticated;
grant select on public.cwl_change_events to authenticated;

create function private.cwl_audit_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  member_names text[];
  old_members jsonb := '[]'::jsonb;
  new_members jsonb := '[]'::jsonb;
  changes jsonb;
begin
  if tg_op = 'UPDATE' then
    old_members := case when jsonb_typeof(old.profile_json->'members') = 'array' then old.profile_json->'members' else '[]'::jsonb end;
  end if;
  new_members := case when jsonb_typeof(new.profile_json->'members') = 'array' then new.profile_json->'members' else '[]'::jsonb end;

  select coalesce(array_agg(distinct left(coalesce(x->>'name','Unbekannt'),60)),'{}'::text[])
    into member_names
  from jsonb_array_elements(new_members) as x
  where not exists(select 1 from jsonb_array_elements(old_members) as y
                   where x->>'id' = y->>'id' and x = y);

  changes := jsonb_build_object(
    'mitglieder', jsonb_array_length(new_members),
    'aenderungen_mitglieder', to_jsonb(member_names[1:20]),
    'weitere_mitglieder', greatest(coalesce(array_length(member_names,1),0)-20,0),
    'kriege_gespielt', (select count(*) from jsonb_array_elements(
      case when jsonb_typeof(new.profile_json->'locks')='array'
        then new.profile_json->'locks' else '[]'::jsonb end
    ) l where l->>'locked'='true')
  );

  insert into public.cwl_change_events(clan_id,actor_id,revision,event_type,details)
  values(new.clan_id, auth.uid(), new.revision,
         case when tg_op='INSERT' then 'profile_created' else 'profile_updated' end,changes);
  return new;
end;
$$;
revoke all on function private.cwl_audit_profile() from public;
create trigger cwl_audit_profile_changes
 after insert or update on public.cwl_cloud_profiles
 for each row execute function private.cwl_audit_profile();

create function private.cwl_issue_short_invite(p_clan uuid,p_role text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
        v_code text;
begin
 if v_user is null or not exists(select 1 from public.cwl_clans where id=p_clan and owner_user_id=v_user) then
   raise exception 'Only owner may invite' using errcode='42501';
 end if;
 if p_role not in ('editor','viewer') then raise exception 'Invalid role' using errcode='22023';end if;
 -- 9 random bytes = 72 bits, URL-safe and 12 chars (vs. 36-char UUID).
 v_code := translate(rtrim(encode(gen_random_bytes(9),'base64'),'='),'+/','-_');
 insert into public.cwl_clan_invites(clan_id,created_by,role,expires_at,short_code_hash)
 values (p_clan,v_user,p_role,now()+interval '7 days',encode(sha256(convert_to(v_code,'UTF8')),'hex'));
 return v_code;
end;
$$;
revoke all on function private.cwl_issue_short_invite(uuid,text) from public;
grant execute on function private.cwl_issue_short_invite(uuid,text) to authenticated;
create function public.cwl_create_short_invite(p_clan uuid,p_role text)
returns text language sql security invoker set search_path=''
as $$select private.cwl_issue_short_invite(p_clan,p_role)$$;
revoke all on function public.cwl_create_short_invite(uuid,text) from public,anon;
grant execute on function public.cwl_create_short_invite(uuid,text) to authenticated;

create function private.cwl_accept_short_invite(p_code text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
        v_row public.cwl_clan_invites%rowtype;
begin
 if v_user is null then raise exception 'Login required' using errcode='42501'; end if;
 if p_code is null or p_code !~ '^[a-zA-Z0-9_-]{12}$' then
   raise exception 'Invalid invitation' using errcode='22023';
 end if;
 select * into v_row from public.cwl_clan_invites
 where short_code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex')
  and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitation expired or invalid' using errcode='22023';end if;
 insert into public.cwl_clan_memberships(clan_id,user_id,role)
 values (v_row.clan_id,v_user,v_row.role)
 on conflict (clan_id,user_id) do nothing;
 update public.cwl_clan_invites set used_at=now(), used_by=v_user where id=v_row.id;
 return v_row.clan_id;
end;
$$;
revoke all on function private.cwl_accept_short_invite(text) from public;
grant execute on function private.cwl_accept_short_invite(text) to authenticated;
create function public.cwl_redeem_short_invite(p_code text)
returns uuid language sql security invoker set search_path=''
as $$ select private.cwl_accept_short_invite(p_code) $$;
revoke all on function public.cwl_redeem_short_invite(text) from public,anon;
grant execute on function public.cwl_redeem_short_invite(text) to authenticated;

create function private.cwl_set_alias(p_clan uuid,p_name text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or p_name is null or length(btrim(p_name)) not between 1 and 60 then
   raise exception 'Invalid name or login' using errcode='22023';
 end if;
 update public.cwl_clan_memberships set display_name=btrim(p_name)
 where clan_id=p_clan and user_id=auth.uid();
 if not found then raise exception 'Not a clan member' using errcode='42501';end if;
end;
$$;
revoke all on function private.cwl_set_alias(uuid,text) from public;
grant execute on function private.cwl_set_alias(uuid,text) to authenticated;
create function public.cwl_set_my_alias(p_clan uuid,p_name text)
returns void language sql security invoker set search_path=''
as $$select private.cwl_set_alias(p_clan,p_name)$$;
revoke all on function public.cwl_set_my_alias(uuid,text) from public,anon;
grant execute on function public.cwl_set_my_alias(uuid,text) to authenticated;
